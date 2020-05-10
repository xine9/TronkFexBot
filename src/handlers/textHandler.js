const Markup = require("telegraf/markup");
const { sessionInit } = require("../sessionInit");
const { transactionInit } = require("../transactionInit");
const { dbLock } = require("../dbLock/dbLock");
const { toggleLock } = require("../dbLock/toggleLock");
const { isBanned } = require("../utils/isBanned");

module.exports.textHandler = async bot => {
  bot.on("text", async ctx => {
    if (ctx.chat.type == "private") {
      privateChat(ctx);
    } else if (ctx.chat.type == "group" || "supergroup") {
      await groupChat(ctx);
    }
  });
};

// Default answer to unknown messages
const privateChat = ctx => {
  ctx.reply(
    `Hello ${ctx.from.first_name} this is tkf tip bot.\nSee /help for more info.`,
    Markup.keyboard([
      ["/balance", "/help"],
      ["/deposit", "/withdraw"]
    ])
      .oneTime()
      .resize()
      .extra()
  );
};

const groupChat = async ctx => {
  /// Listen for Tip Message from Group Chat
  // RegEx "[number] tkf";
  // Example: "10 tkf" , " 10tkf" , "10 tkf";

  const re = /[0-9]+ *tkf/gi;
  const reComma = /(\d{0,3},)?(\d{3},)?\d{0,3} *tkf/gi;
  const reDot = /\d*\.?\d* *tkf/gi;
  const reClown = /🎈/g;
  const reCircus = /💊/g;

  if (ctx.message.reply_to_message) {
    let text = ctx.message.text;
    const banMsg = '😢 Your account has been suspended!';

    if (parseFloat(text.match(reDot)) || parseFloat(text.match(reComma))) {
      text = text.includes(".") ? text.match(reDot)[0] : text.match(reComma)[0];

      if (text.includes(".")) {
        // With dot "[number].[number] tkf"
        ctx.replyWithMarkdown(
          `*${ctx.from.first_name}* the lowest amount to give/send/tip is 1 TKF. Please check your amount and try again.`
        );
      } else if (text.includes(",")) {
        // With comma "[number],[number] tkf"
        let amount = text.replace(/,/g, "");

        if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
        const tipResult = await tip(ctx, amount);
        ctx.replyWithMarkdown(tipResult);
      } else if (text.match(re)) {
        //"[number] tkf"
        let amount = ctx.message.text.match(re)[0].split(" ")[0];

        if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
        const tipResult = await tip(ctx, amount);
        ctx.replyWithMarkdown(tipResult);
      }
    } else if (text.match(reClown) || text.match(reCircus)) {
      // reClown && reCircus
      let amount = 0;
      if (text.match(reClown)) {
        const matchArray = text.match(reClown);
        amount += matchArray.length * 25;
      }

      if (text.match(reCircus)) {
        const matchArray = text.match(reCircus);
        amount += matchArray.length * 10;
      }

      if (isBanned(ctx.from.id)) return ctx.reply(banMsg);
      const tipResult = await tip(ctx, amount);
      ctx.replyWithMarkdown(tipResult);
    }
  }
};

const tip = async (ctx, amount) => {
  amount = parseInt(amount);
  const fromUser = ctx.from;
  const toUser = ctx.message.reply_to_message.from;

  if (fromUser.id === toUser.id) return `*${fromUser.first_name}*  👏`;
  try {
    await dbLock(ctx, fromUser.id);
    if (fromUser.id !== toUser.id) await dbLock(ctx, toUser.id);
  } catch (err) {
    console.log("testHandler:: 🗝 dbLock error while trying make tip:", err);
    return `*${fromUser.first_name}* sorry, try later.`;
  }
  await sessionInit(ctx);

  // Tip to bot deprecated
  if (toUser.is_bot) {
    if (fromUser.id !== toUser.id) toggleLock(ctx, toUser.id);
    toggleLock(ctx, fromUser.id);
    return `*${fromUser.first_name}* you can't tip to bot`;
  }

  const transactionSuccess = await transactionInit(amount, ctx, toUser);

  if (fromUser.id !== toUser.id) toggleLock(ctx, toUser.id);
  toggleLock(ctx, fromUser.id);

  let msg = "";
  if (transactionSuccess) {
    msg += `*${fromUser.first_name}* sent ${amount.toLocaleString(
      "en-US"
    )} 💸*TKF* to *${toUser.first_name}*`;
  } else {
    console.log("Need more TKF");
    msg += `*${fromUser.first_name}* you need more *TKF*❌`;
  }
  return msg;
};
