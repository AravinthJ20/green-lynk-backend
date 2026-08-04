const helpTool = require('./helpTool');
const smallTalkTool = require('./smallTalkTool');
const clarifyActionTool = require('./clarifyActionTool');
const sendConnectionRequestTool = require('./sendConnectionRequestTool');
const accessRequestsTool = require('./accessRequestsTool');
const sendMessageTool = require('./sendMessageTool');
const createStatusTool = require('./createStatusTool');
const deleteStatusTool = require('./deleteStatusTool');
const startCallTool = require('./startCallTool');
const searchLocationTool = require('./searchLocationTool');
const recommendInterestTool = require('./recommendInterestTool');
const summarizeChatTool = require('./summarizeChatTool');
const createReminderTool = require('./createReminderTool');
const searchUsersTool = require('./searchUsersTool');
const manageRequestsTool = require('./manageRequestsTool');
const fetchPostsTool = require('./fetchPostsTool');

const toolModules = [
  helpTool,
  smallTalkTool,
  clarifyActionTool,
  sendConnectionRequestTool,
  accessRequestsTool,
  sendMessageTool,
  createStatusTool,
  deleteStatusTool,
  startCallTool,
  searchLocationTool,
  recommendInterestTool,
  summarizeChatTool,
  createReminderTool,
  searchUsersTool,
  manageRequestsTool,
  fetchPostsTool
];

const exportedTools = () => toolModules.map((tool) => tool.definition);

const getToolNames = () => toolModules.map((tool) => tool.definition.name);

const getToolByName = (name) => toolModules.find((tool) => tool.definition.name === name);

module.exports = {
  exportedTools,
  getToolNames,
  getToolByName
};