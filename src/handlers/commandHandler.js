const Markup = require("telegraf/markup");
const { sessionInit } = require("../sessionInit");
const { deposit } = require("./commands/deposit");
const { balance } = require("./commands/balance");
const { withdraw } = require("./commands/withdraw");
const { isBanned } = require("../utils/isBanned")
// const { checkDeposits } = require("./commands/checkDeposits");

module.exports.commandHandler = bot => {
  bot.start(async ctx => {
    if (ctx.chat.type == "private") await start(ctx);
  });

  bot.help(ctx => {
    if (ctx.chat.type == "private") help(ctx);
  });

  bot.command("menu", ctx => {
    if (ctx.chat.type == "private") menu(ctx);
  });

  bot.command("balance", async ctx => {
    await isAllowed(ctx, balance);
  });

  bot.command("deposit", async ctx => {
    await isAllowed(ctx, deposit);
  });

  bot.command("withdraw", async ctx => {
    if (isBanned(ctx.from.id)) return ctx.reply('🤷‍♂️ Your account has been suspended!');
    await isAllowed(ctx, withdraw);
  });
};

const isAllowed = async (ctx, commandFunction) => {
  if (ctx.chat.type == "private") {
    if (ctx.from.is_bot) return ctx.reply("Only humans accepted.");
    if (!ctx.session.wallet) await sessionInit(ctx);
    await commandFunction(ctx);
  }
};

const start = async ctx => {
  await sessionInit(ctx);

  ctx.reply(
    `Hello ${ctx.from.first_name}!`,
    Markup.keyboard([
      ["/balance", "/help"],
      ["/deposit", "/withdraw"]
    ])
      .oneTime()
      .resize()
      .extra()
  );
};

const help = ctx => {
  helpMsg = `
❌*TKF BOT HELP PAGE*❌\nWhat can I help you with? Here are a list of my commands:
                          
Type:

/deposit - for information on depositing 
/help - for information on tipping *TKF* 
/withdraw - withdrawing *TKF*  
/balance - get your *TKF* balance
`;
  ctx.replyWithMarkdown(
    helpMsg,
    Markup.keyboard([
      ["/balance", "/help"],
      ["/deposit", "/withdraw"]
    ])
      .oneTime()
      .resize()
      .extra()
  );
};

const menu = ctx => {
  ctx.reply(
    `Main Menu:`,
    Markup.keyboard([
      ["/balance", "/help"],
      ["/deposit", "/withdraw"]
    ])
      .oneTime()
      .resize()
      .extra()
  );
};
