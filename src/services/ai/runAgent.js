const { GreenLynkAgent } = require('./greenLynkAgent');

const greenLynkAgent = new GreenLynkAgent();

const runAgent = ({ userId, message }) => greenLynkAgent.run({ userId, message });

module.exports = {
  greenLynkAgent,
  runAgent
};
