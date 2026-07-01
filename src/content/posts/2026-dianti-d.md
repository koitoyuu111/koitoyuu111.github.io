---
title: 2026 电赛校赛 D 题 — 云台视觉追踪系统
published: 2026-06-10T00:00:00.000Z
description: '基于 STM32F407 + K230 视觉模块的云台视觉追踪系统，实现矩形靶子识别与伺服跟踪'
image: '/images/project-2026-1.jpg'
tags: [电赛, STM32, 机器视觉, PID控制, CAN总线]
category: 项目分享
---

## 项目概述

2026 年电子设计竞赛校赛 D 题，构建了一套云台视觉追踪与小车运动控制系统。

## 视觉识别

云台端搭载 **K230 视觉模块**，基于 `cv_lite` Canny 边缘提取 + 矩形拟合 + 对角线交点定位，识别 2026 电赛 E 题矩形靶子中心坐标。通过 UART2 (921600bps) 将靶子 X/Y 偏移实时发送给 STM32F407 云台。

## 云台控制

云台搭载 **WT9011 姿态传感器**，CAN 总线控制 **DM4310 伺服电机**，1000Hz 主控循环中运行速度环 + 位置环 + 角度环 PID。

## 小车运动

小车端基于速度环 PID 配合圆弧路径规划实现平滑接近靶子。两机蓝牙 + UART 协同，VOFA 实时可视化。

## 技术关键词

`STM32F407` `K230 cv_lite` `矩形靶子` `CAN总线` `DM4310` `WT9011` `速度环+位置环` `圆弧路径`

[GitHub 仓库](https://github.com/koitoyuu111/2026_School_Competition_Problem_D)
