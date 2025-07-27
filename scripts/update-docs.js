import { promises as fs } from "fs";
import { join } from "path";

class DocumentUpdater {
  constructor(workspacePath) {
    this.docsPath = join(workspacePath, "docs");
  }

  async readMarkdownFile(filename) {
    const filePath = join(this.docsPath, filename);
    return await fs.readFile(filePath, "utf-8");
  }

  async writeMarkdownFile(filename, content) {
    const filePath = join(this.docsPath, filename);
    await fs.writeFile(filePath, content, "utf-8");
  }

  parseTaskList(content) {
    const tasks = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const taskMatch = line.match(/^- \[([ x])\] (.+)$/);
      if (taskMatch) {
        tasks.push({
          completed: taskMatch[1] === "x",
          text: taskMatch[2].trim(),
        });
      }
    }

    return tasks;
  }

  async updateMVPChecklist(nextStepsTasks) {
    const mvpContent = await this.readMarkdownFile("MVP_CHECKLIST.md");
    let updatedContent = mvpContent;

    // For each completed task in NEXT_STEPS, find and update corresponding task in MVP_CHECKLIST
    for (const task of nextStepsTasks) {
      if (task.completed) {
        const taskRegex = new RegExp(
          `- \\[[ x]\\] ${task.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          "g"
        );
        updatedContent = updatedContent.replace(
          taskRegex,
          `- [x] ${task.text}`
        );
      }
    }

    await this.writeMarkdownFile("MVP_CHECKLIST.md", updatedContent);
  }

  async updateRoadmap(mvpTasks) {
    const roadmapContent = await this.readMarkdownFile("ROADMAP.md");
    let updatedContent = roadmapContent;

    // For each completed task in MVP_CHECKLIST, find and update corresponding milestone in ROADMAP
    for (const task of mvpTasks) {
      if (task.completed) {
        const taskRegex = new RegExp(
          `- \\[[ x]\\] \\*\\*${task.text.split(" ")[0]}[^*]+\\*\\*`,
          "g"
        );
        updatedContent = updatedContent.replace(taskRegex, (match) =>
          match.replace("[ ]", "[x]")
        );
      }
    }

    await this.writeMarkdownFile("ROADMAP.md", updatedContent);
  }

  async update() {
    console.log("Starting documentation update...");

    // Read and parse NEXT_STEPS.md
    const nextStepsContent = await this.readMarkdownFile("NEXT_STEPS.md");
    const nextStepsTasks = this.parseTaskList(nextStepsContent);

    // Update MVP_CHECKLIST based on NEXT_STEPS
    await this.updateMVPChecklist(nextStepsTasks);

    // Read and parse updated MVP_CHECKLIST
    const mvpContent = await this.readMarkdownFile("MVP_CHECKLIST.md");
    const mvpTasks = this.parseTaskList(mvpContent);

    // Update ROADMAP based on MVP_CHECKLIST
    await this.updateRoadmap(mvpTasks);

    console.log("Documentation update completed.");
  }
}

// Main execution
const workspacePath = process.env.WORKSPACE_PATH || process.cwd();
const updater = new DocumentUpdater(workspacePath);
updater.update().catch(console.error);

export { DocumentUpdater };
