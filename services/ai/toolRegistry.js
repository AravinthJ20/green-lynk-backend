const toolRegistry = require('./tools');

const getTool = (name) => toolRegistry.getToolByName(name);

const getToolNames = () => toolRegistry.getToolNames();

const getToolPrompt = () =>
  toolRegistry
    .exportedTools()
    .map((tool) => {
      const parameterEntries = Object.entries(tool.parameters);
      const params = parameterEntries.length === 0
        ? 'none'
        : parameterEntries.map(([key, description]) => `${key}: ${description}`).join('; ');
      return `- ${tool.name}: ${tool.description} Parameters: ${params}`;
    })
    .join('\n');

module.exports = {
  getTool,
  getToolNames,
  getToolPrompt
};
