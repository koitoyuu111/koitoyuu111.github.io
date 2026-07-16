---
title: 电赛 M0G3507 — 从 F407 移植到 TI 新平台的双轮差速机器人
published: 2026-07-16T00:00:00.000Z
description: '基于 TI MSPM0G3507 (ARM Cortex-M0+, 80MHz) 的双轮差速机器人，从 STM32F407 完整移植运控代码'
image: '/images/project-mspm0.jpg'
tags: [MSPM0G3507, TI, 双轮差速, PID, IMU, 嵌入式]
category: 项目分享
---

## 项目概述

将原本跑在 STM32F407 上的双轮差速机器人运控代码，完整移植到 TI MSPM0G3507 (ARM Cortex-M0+, 80MHz)。支持 Keil / IAR / GCC 三套工具链。

## 硬件平台

| 模块 | 型号 | 接口 |
| --- | --- | --- |
| 主控 | MSPM0G3507 (Cortex-M0+, 80MHz) | - |
| 电机驱动 | TB6612FNG | PWM + GPIO |
| 陀螺仪 | WT9011 | UART DMA / 软件 I2C |
| 显示屏 | 0.96" OLED + 串口屏 | 软件 I2C / UART |
| 编码器 | 增量式 x2 | QEI + 外部中断 4 倍频 |
| 循迹 | 8 路红外 | I2C |
| 调试 | VOFA 上位机 | UART 1152000bps |

## 软件架构

所有运控逻辑在 TIMA1 200Hz 定时器中断中执行：

```
SysTick 1ms
    └── 200Hz TIMA1 中断
        ├── 读编码器 (左 QEI + 右外部中断 4 倍频)
        ├── 独立双轮 PID 速度环
        ├── TB6612 电机输出
        ├── 按键处理
        └── LCD / OLED 显示刷新
```

## 核心模块

### PID 控制

- **速度环**：带一阶低通滤波 (α=0.15) 的增量式 PID，积分限幅 ±3000
- **角度环**：PD 控制，带 ±180° 角度 wrapping
- **转向环**：角速度 × Kd + 遥控 × Kp

### WT9011 IMU

支持 UART DMA 和软件 I2C 两种通信方式：

- UART 模式：DMA 收满 11 字节触发中断，字节级状态机解析 0x55 协议
- I2C 模式：PA29(SCL)/PA30(SDA) 软件模拟 I2C，支持地址扫描和零偏校准

### 编码器

- 左编码器：TIMG8 QEI 硬件解码 (PA26/PA27)
- 右编码器：PA15/PA16 双边沿外部中断，软件 4 倍频正交解码

### 循迹传感器

8 路红外循迹模块通过 I2C 读取，逐级差速转向策略：从中心到外侧，转向幅度递增。

## 从 F407 移植的要点

1. HAL → DriverLib：所有 GPIO/UART/Timer/DMA 操作改用 TI DL 库
2. CubeMX → SysConfig：外设引脚配置迁移到 TI SysConfig
3. 中断向量名变更：如 `TIM1_UP_IRQHandler` → `TIMA1_IRQHandler`
4. DMA 源/目标地址需手动设置（SysConfig 不生成这部分）
5. 编码器 QEI 和 PWM 定时器的寄存器映射差异

## 技术关键词

`MSPM0G3507` `TB6612` `WT9011 IMU` `PID 速度环` `QEI 编码器` `4倍频正交解码` `200Hz运控` `OLED` `VOFA调试` `8路循迹`

[GitHub 仓库](https://github.com/koitoyuu111/MSPM0G3507)
