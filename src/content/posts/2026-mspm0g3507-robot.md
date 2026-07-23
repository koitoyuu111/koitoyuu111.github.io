---
title: 电赛 M0G3507 — 从 F407 移植到 TI 新平台的双轮差速机器人
published: 2026-07-16T00:00:00.000Z
description: '基于 TI MSPM0G3507 (ARM Cortex-M0+, 80MHz) 的双轮差速机器人，自制 PCB，从 STM32F407 完整移植运控代码'
image: '/images/project-mspm0.png'
tags: [MSPM0G3507, TI, 双轮差速, PID, IMU, 嵌入式]
category: 项目分享
series: 电赛系列
seriesOrder: 3
---

## 项目概述

将原本跑在 STM32F407 上的双轮差速机器人运控代码，完整移植到 TI MSPM0G3507 (ARM Cortex-M0+, 80MHz)。自制 PCB（TwoSunday 板），支持 Keil / IAR / GCC / TI Clang 四套工具链。

## 自制 PCB

![MSPM0G3507 自制 PCB](/images/project-mspm0.png)

红色 PCB 为自主设计的 **TwoSunday** 控制板，集成：

- MSPM0G3507 主控最小系统（SWD 调试接口: RST / BSL / DRIVE）
- TB6612 电机驱动接口（PWM x2 + 方向 GPIO）
- MaixCam2 / K230 视觉模块接口（UART + 5V 供电）
- WT9011 IMU 接口（UART / I2C 可选）
- 编码器接口 x2（QEI + 外部中断）
- 0.96" OLED 显示屏接口（软件 I2C）
- 8 路循迹传感器接口（GPIO）
- 12V 电源输入 + 3.3V LDO
- VOFA 调试接口（UART 1152000bps）

## 硬件平台

| 模块 | 型号 | 接口 | 引脚 |
| --- | --- | --- | --- |
| 主控 | MSPM0G3507 (Cortex-M0+, 80MHz) | - | - |
| 电机驱动 | TB6612FNG | PWM + GPIO | PA0/PA1 (AIN), PB15/PB16 (BIN) |
| 视觉模块 | K230 / MaixCam2 | UART DMA | UART2 (MaixCam2), UART3 (K230) |
| 陀螺仪 | WT9011 | UART DMA / 软件 I2C | UART1 / PA29(SCL)+PA30(SDA) |
| 显示屏 | 0.96" OLED | 软件 I2C | - |
| 左编码器 | 增量式 | QEI 硬件解码 | PA3/PA4 (TIMG8) |
| 右编码器 | 增量式 | 外部中断 4 倍频 | PA8/PA9 (双边沿) |
| 循迹 | 8 路红外 | GPIO | PB22/PA24/PA25/PB25/PB26/PB27/PA26/PA27 |
| 调试 | VOFA 上位机 | UART | 1152000bps |

## 软件架构

所有运控逻辑在 **TIMA1 200Hz** 定时器中断中执行：

```
SysTick 1ms (80MHz / 1000)
    └── 200Hz TIMA1 中断 (TIMER_0, 优先级 0)
        ├── 读编码器
        │   ├── 左: TIMG8 QEI 硬件解码 (PA3/PA4)
        │   └── 右: PA8/PA9 双边沿外部中断, 软件 4 倍频正交解码
        ├── 独立双轮 PID 速度环
        │   ├── 一阶低通滤波 (α=0.15)
        │   ├── 增量式 PID, 积分限幅 ±3000
        │   └── 输出 → TB6612 PWM (0~8000)
        ├── 按键处理 (KEY_Proc)
        └── OLED 显示刷新 (20Hz)
```

## 核心模块详解

### PID 控制器

四组独立 PID 参数结构体：

```c
typedef struct PID_Param {
    volatile float P, I, D;       // 比例/积分/微分系数
    volatile float err, err_I;    // 当前误差 / 积分累加
    volatile float err_last, derr;// 上次误差 / 微分
    volatile float out;           // 输出
} PID_Param;
```

| 环 | 类型 | 参数 | 说明 |
| --- | --- | --- | --- |
| 速度环 (L/R) | 增量式 PID | P=-1, 滤波α=0.15, 积分限幅±3000 | 独立双轮，一阶低通滤波抑制编码器噪声 |
| 角度环 | 位置式 PD | P=60, D=8, 积分限幅±2000 | ±180° 角度 wrapping |
| 转向环 | 增量式 PD | P=1, D=0.05, 积分限幅±50 | 角速度 × Kd + 遥控 × Kp |

速度环核心算法：

```c
float PID_L_Velocity(float tgt, int16_t encoder) {
    float a = 0.15f;  // 一阶低通滤波系数
    Velo_L.err = encoder - tgt;
    Velo_L.err = (1-a) * Velo_L.err_last + a * Velo_L.err;  // 低通滤波
    Velo_L.err_I += Velo_L.err;
    _limit(Velo_L.err_I, -3000, 3000);  // 积分限幅
    Velo_L.derr = Velo_L.err - Velo_L.err_last;
    Velo_L.out += P*err + I*err_I + D*derr;  // 增量式
    return Velo_L.out;
}
```

### 编码器

**左编码器 — QEI 硬件解码 (PA3/PA4, TIMG8)**

SysConfig 配置 TIMG8 为 QEI 模式，硬件自动解码正交信号。读取时直接取计数器值并清零：

```c
int Encoder_EXTI_Read(void) {
    int16_t cnt = (int16_t)(TIM8_Encoder_INST->COUNTERREGS.CTR & 0xFFFF);
    TIM8_Encoder_INST->COUNTERREGS.CTR = 0;
    return (int)cnt;
}
```

**右编码器 — 外部中断软件 4 倍频 (PA8/PA9)**

PA8(A相) + PA9(B相) 配置为双边沿中断，一个正交周期触发 4 次中断：

```c
void GROUP1_IRQHandler(void) {
    uint8_t a = readPA8(), b = readPA9();
    if (status & ENC_R_A_PIN) {
        (a ^ b) ? encoder_cnt_B++ : encoder_cnt_B--;  // A相边沿
    }
    if (status & ENC_R_B_PIN) {
        (a ^ b) ? encoder_cnt_B-- : encoder_cnt_B++;  // B相边沿(方向取反)
    }
}
```

正交状态序列（正转）: `00→10→11→01→00`，通过 `A^B` 异或判断方向。

### K230 / MaixCam2 视觉模块

两种视觉模块使用相同的自定义协议，通过 UART DMA 接收：

**帧格式**: `0xFF 0xFE cmd_id dataL dataH`

| cmd_id | 含义 | 数据 |
| --- | --- | --- |
| 0x01 | X 坐标偏差 | int16, 限幅 ±50 |
| 0x02 | Y 坐标偏差 | int16, 限幅 ±50 |
| 0x03 | 未检测到目标 | 标志位 |

接收采用 **4 状态状态机** + **跳变滤波**（相邻帧差值 > 40 则丢弃）：

```c
// DMA 接收完成后逐字节解析
void UART2_IRQHandler(void) {
    case DL_UART_MAIN_IIDX_DMA_DONE_RX:
        for (int i = 0; i < BUF_SIZE; i++)
            MAIXCAM2_RX(g_maixcam2_dma_buf[i]);
        // 重启 DMA
        DL_DMA_setDestAddr(...);
        DL_DMA_enableChannel(...);
}
```

- **K230**：UART3 + DMA_CH3，嘉楠 AI 视觉模块，运行 kmodel 目标检测
- **MaixCam2**：UART2 + DMA_CH1，硅速科技视觉模块，支持颜色追踪、二维码识别

### 8 路循迹传感器

GPIO 直接读取电平（0=黑线, 1=白色地面），逐级差速转向策略：

| 传感器位置 | 速度 | 转向角速度 | 说明 |
| --- | --- | --- | --- |
| L4 / R4 (最外侧) | 11 | ±4.5 | 轻微修正 |
| L3 / R3 | 10 | ±8.5 | 中等转向 |
| L2 / R2 | 9.5 | ±11 | 较大转向 |
| L1 / R1 (最内侧) | 9 | ±14 | 急转弯 |
| 全部为 1 | - | - | 丢线标志 |

### TB6612 电机驱动

PWM 周期 8000（80MHz / 10kHz），双通道独立控制：

```c
void Motor_TB6612_SetSpeed(MotoSelect m, int32_t speed) {
    uint32_t duty = ABS(speed);
    if (duty > 8000) duty = 8000;
    // 方向控制: GPIO 高低电平
    // PWM 占空比: DL_TimerA_setCaptureCompareValue()
}
```

## 从 F407 移植的要点

| 项目 | STM32F407 | MSPM0G3507 |
| --- | --- | --- |
| 库 | HAL | TI DriverLib |
| 配置工具 | CubeMX | SysConfig |
| 中断名 | `TIM1_UP_IRQHandler` | `TIMA1_IRQHandler` |
| DMA | HAL_DMA_Start | DL_DMA_setSrcAddr + setDestAddr + enableChannel |
| 编码器 | TIM_Encoder | TIMG QEI 硬件 / GPIO 外部中断 |
| PWM | HAL_TIM_PWM_Start | DL_TimerA_setCaptureCompareValue |
| 波特率 | huart.Init.BaudRate | UART_SetBaudRate() 运行时动态设置 |

**注意事项**：

1. SysConfig 不生成 DMA 源/目标地址配置，需手动调用 `DL_DMA_setSrcAddr/setDestAddr`
2. SysConfig 自动使能的按键中断可能导致 NVIC 死循环，需手动关闭
3. MSPM0 的 GPIO 中断按 Port 分组（GROUP0/GROUP1），与 F407 的 EXTI 不同

## 技术关键词

`MSPM0G3507` `TB6612` `WT9011 IMU` `PID 速度环` `QEI 编码器` `4倍频正交解码` `200Hz运控` `OLED` `VOFA调试` `8路循迹` `K230` `MaixCam2` `自制PCB` `DMA` `SysConfig` `DriverLib`

[GitHub 仓库](https://github.com/koitoyuu111/MSPM0G3507)
