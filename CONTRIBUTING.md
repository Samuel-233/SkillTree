# Contributing Guide

Thank you for your interest in contributing to this project!  
This repository aims to build a visual knowledge and skill tree based on the [ISCED-F 2013](public\international-standard-classification-of-education-fields-of-education-and-training-2013-detailed-field-descriptions-2015-en.pdf) classification.  
Your contributions—whether in data, code, or documentation—are all welcome.

---

## Ways to Contribute

### 1. Add or Improve Subfield Data (Most Needed)

Each field or subfield is stored as a JSON file under the `data/<language>/` directory.

For example:  
- `public\data\en\0611.json` represents the subfield “Computer use”  
- It may contain tiny units such as:
  - Use of spreadsheets  
  - Use of software for data processing  
  - Use of the Internet, etc.

Your task is to provide:

- A clear `name` for each small unit
- A short `description`
- A `wiki` or reference link (e.g., Wikipedia)
- A list of useful `resources` (articles, videos, courses)

**Sample format:**

```json
[
  {
    "name": "Use of spreadsheets",
    "description": "How to use software for calculations and organizing data.",
    "wiki": "https://en.wikipedia.org/wiki/Spreadsheet",
    "resources": [
      {
        "title": "Excel Basics - YouTube Tutorial",
        "url": "https://www.youtube.com/watch?v=rwbho0CgEAE"
      }
    ]
  }
]
```

When you're done:

- Commit the modified or new JSON file
- Create a Pull Request (PR) with a clear title and description

---

### 2. Improve the Code or Documentation

This project is written in TypeScript, but as the author is a beginner in TS, the code may be naive or repetitive.  
Feel free to help with:

- Refactoring code
- Adding missing error handling
- Improving component logic or structure
- Fixing bugs or improving styling
- Enhancing documentation or fixing typos

Please try to keep your changes clean and well-scoped.

---

## Development Setup

To run the project locally:

```bash
git clone https://github.com/Samuel-233/SkillTree.git
cd SkillTree
npm install
npm run dev
```

---

## Pull Request Guidelines

1. Fork the repository
2. Create a new branch (e.g., `add-0611-details`)
3. Make your changes
4. Push your branch and create a Pull Request
5. In your PR, describe clearly what you’ve done

---

## Issues and Feedback

- Not sure how to contribute? Feel free to open an issue to ask questions or suggest ideas.
- Contributions don’t need to be “professional.” If you’re willing to research and organize information, that’s already very valuable.

---

This is the author’s **first open-source project**. The code isn't perfect, and the structure may be rough,  
but the goal is meaningful, and every contributor makes it better.

Thank you for being here!

