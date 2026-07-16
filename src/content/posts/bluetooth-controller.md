---
title: STM32 蓝牙手柄控制器
published: 2026-06-25T00:00:00.000Z
description: '基于 STM32F103 自制的蓝牙无线手柄，双摇杆+9键，1000Hz 实时数据传输'
image: '/images/project-bluetooth.jpg'
tags: [STM32, 蓝牙, 手柄, ADC, DMA, 自定义协议]
category: 项目分享
---

## 项目概述

基于 STM32F103 自制的蓝牙无线手柄，通过蓝牙模块与小车/机器人进行无线通信，实现远程遥控操作。自定义按键映射与通信协议，支持双摇杆模拟量输入与多路按键数字量输入。

硬件开源，B站作者荞麦面先森c，[视频链接](https://www.bilibili.com/video/BV1zKxDewEiC/)

## 技术栈

| 类别 | 内容 |
|------|------|
| 主控芯片 | STM32F103 (Cortex-M3) |
| 主频 | 72MHz (HSE 8MHz → PLL ×9) |
| 开发环境 | Keil MDK |
| 固件库 | STM32 HAL Library |
| 通信方式 | 蓝牙无线通信 (USART3) |
| 编程语言 | C |

## 外设清单

| 外设 | 实例 | 引脚 | 功能 | 配置 |
|------|------|------|------|------|
| ADC | ADC1 | PA1/PA4/PA5/PA6/PA7 | 双摇杆 XY 轴 + 电池电压 | 5通道扫描连续转换，DMA1_Ch1 循环传输 |
| TIM | TIM2 | — | 系统心跳定时器 | 72M/72/5000 = 1000Hz 中断 |
| USART | USART3 | PB10(TX)/PB11(RX) | 蓝牙模块通信 | 38400bps, DMA 收发 |
| GPIO | 多引脚 | — | 9键输入 | 上拉输入，下降沿检测 |
| DMA | DMA1_Ch1 | — | ADC 数据搬运 | 循环模式，半字传输 |
| DMA | DMA1_Ch2/Ch3 | — | USART3 收发 | — |

## 任务 / 中断

| 任务 / 中断 | 频率 | 功能 |
|-------------|------|------|
| TIM2_IRQHandler | 1000Hz | 按键扫描、摇杆 ADC 处理（低通滤波 + 死区 + 映射）、电池电压、定时发送数据 |
| USART3_IRQHandler | IDLE 中断 | 蓝牙数据接收，DMA 空闲中断解析协议帧 |
| main() 循环 | — | 空闲等待，所有逻辑在中断中完成 |

## 摇杆数据处理

- 输入：2个双轴摇杆（4路 ADC）+ 1路电池电压
- 低通滤波系数：α = 0.3
- 死区范围：±100（ADC 值，中值 2048）
- 输出映射范围：±50.0
- 支持方向反转

## 通信协议

### 发送 (手柄 → 小车)

```
帧头: 0xFF 0xFE
字节2: 命令ID (0x01=右摇杆X, 0x02=左摇杆Y, 0x07=yaw切换)
字节3-6: float 数据 (4字节, 小端)
总长度: 7 字节
```

DMA 发送，每 2 次 TIM2 中断交替发送不同摇杆数据。

### 接收 (小车 → 手柄)

```
帧头: 0xFF 0xFE
字节2: 命令ID
字节3-6: float 数据 (4字节)
```

使用 DMA 循环接收 + UART IDLE 中断解析。

## 按键功能

| 按键 | 功能 |
|------|------|
| KEY_A | 切换 Yaw 模式 (发送指令 0x07) |
| KEY_UP/DOWN/LEFT/RIGHT | 预留 |
| KEY_B / KEY_START | 预留 |

## 技术关键词

`STM32F103` `ADC+DMA` `数字滤波` `蓝牙通信` `自定义协议` `1000Hz中断` `无线遥控` `双摇杆`

[GitHub 仓库](https://github.com/koitoyuu111/STM32_Game-controller)
