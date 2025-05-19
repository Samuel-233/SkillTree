# SkillTree：基于 ISCED 的世界知识技能树

本项目旨在基于联合国教科文组织（UNESCO）发布的  
[《ISCED-F 2013 教育和培训领域详细分类说明（2015）》](public/international-standard-classification-of-education-fields-of-education-and-training-2013-detailed-field-descriptions-2015-en.pdf)  
构建一个可视化的全球职业与知识技能树。

---

## 项目简介

- 将 ISCED-F 的知识体系转化为可视化的技能树结构
- 包含从 **大类（0~9）** 到 **详细小类** 的完整结构
- **鼓励社区共建**：每个小类中的细节信息需手动补全
- 使用 **TypeScript 编写**（是我第一次用 TypeScript，很多是让 AI 帮我生成的）

---

## 为什么需要大家一起贡献？

这份分类标准中包含了 **几百个详细小类**，每个小类又可能包含十几个更细的“微技能”。

例如：

- `0611.json` 表示“计算机使用（Computer use）”这一类
  - 其中细分出：
    - 使用电子表格
    - 使用数据处理软件
    - 使用文字处理软件
    - 使用互联网
    - 等等……

这些信息**目前是空的**，需要大家一起补充，包括：

- 微技能的名称
- 简要描述
- 参考链接（如 Wikipedia）
- （可选）相关学习资源、课程或视频

---

## 如何参与？

欢迎任何形式的贡献！特别是：

- 在 `data/en/` 或 `data/zh/` 文件夹中补全对应的 JSON 文件
- 改进项目代码（TypeScript / UI）
- 修复文档错误，或补充使用说明

详见：[CONTRIBUTING.md](./CONTRIBUTING.md)

> 不用担心“自己不够专业”，只要你愿意查找资料并整理清楚，这就是非常宝贵的贡献。

---

## 本地开发指南

如需本地运行项目：

```bash
git clone https://github.com/Samuel-233/SkillTree.git
cd SkillTree
npm install
npm run dev
```

---

## 来自作者的说明

这是我个人的**第一个开源项目**。

- 代码可能写得不太好
- 结构可能还有点乱
- TypeScript 是现学现写
- 但我会持续改进，也欢迎大家来一起完善！

如果你愿意参与、建议、甚至只是帮忙写一个文件，都非常欢迎。
