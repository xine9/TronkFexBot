const Markup = require("telegraf/markup");
const { getSession } = require("../../dynamoDB");
const { sessionInit } = require("../../sessionInit");

module.exports.balance = async ctx => {
  const session = await getSession(ctx.from.id);
  
  if (!session.wallet.tkfPoints) await sessionInit(ctx);

  const tkfPoints = session.wallet.tkfPoints;

  ctx.replyWithMarkdown(
    `*${ctx.from.first_name}* your balance : *${tkfPoints.toLocaleString('en-US')}* 💸*TKF*`,
    Markup.keyboard([["/balance", "/help"], ["/deposit", "/withdraw"]])
      .oneTime()
      .resize()
      .extra()
  );
};
