const cron = require('node-cron');
const AgentReminder = require('../models/AgentReminder');
const User = require('../models/User');
const { sendPushNotification } = require('./push');
const { sendMail } = require('./mail');

const REMINDER_SCHEDULE = process.env.AGENT_REMINDER_CRON || '* * * * *';

const runAgentReminderJob = async () => {
  try {
    const dueReminders = await AgentReminder.find({
      status: 'scheduled',
      remindAt: { $lte: new Date() }
    }).limit(50);

    for (const reminder of dueReminders) {
      const user = await User.findById(reminder.user).select('username email pushSubscriptions');
      if (!user) {
        reminder.status = 'cancelled';
        await reminder.save();
        continue;
      }

      await sendPushNotification(user, {
        title: 'Green Lynk reminder',
        body: reminder.text,
        type: 'agent-reminder',
        url: '/agent'
      });

      await sendMail({
        to: user.email,
        subject: 'Green Lynk reminder',
        text: reminder.text,
        html: `<p>${reminder.text}</p>`
      });

      reminder.status = 'sent';
      reminder.notifiedAt = new Date();
      await reminder.save();
    }
  } catch (error) {
    console.error('Agent reminder cron failed:', error.message);
  }
};

const startAgentReminderCron = () => {
  cron.schedule(REMINDER_SCHEDULE, () => {
    void runAgentReminderJob();
  });
};

module.exports = {
  startAgentReminderCron,
  runAgentReminderJob
};
