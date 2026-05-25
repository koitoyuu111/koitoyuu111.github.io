---
title: STM32 蓝牙手柄控制器
published: 2025-08-10T00:00:00.000Z
description: '基于 STM32F103 自制的蓝牙无线手柄，双摇杆+9键，1000Hz 实时数据传输'
image: '/images/project-bluetooth.jpg'
tags: [STM32, 蓝牙, 手柄, ADC, DMA, 自定义协议]
category: 项目分享
---

## 项目概述

基于 STM32F103 自制的蓝牙无线手柄，用于遥控小车/机器人。

## 硬件设计

- **主控**：STM32F103
- **输入**：双摇杆（4路 ADC DMA 采集）+ 9 键按键
- **通信**：蓝牙模块，USART3 DMA 收发

## 信号处理

摇杆信号经低通滤波（α=0.3）+ 死区处理（±100）+ 线性映射（±50），在 1000Hz 定时中断中完成键值扫描与数据处理。

## 通信协议

自定义 `0xFF 0xFE` 帧协议，交替发送双摇杆数据至小车/机器人。支持 yaw 模式切换与 PID 参数无线调参。

## 技术关键词

`STM32F103` `ADC+DMA` `数字滤波` `蓝牙通信` `自定义协议` `1000Hz中断` `无线调参`

[GitHub 仓库](https://github.com/koitoyuu111/STM32_Game-controller)
