const { checkSLPAddress } = require("../../slp/checkSLPAddress");
const { sendToken } = require("../../slp/send-token");
const { getSession, saveSession } = require("../../dynamoDB");
const { dbLock } = require("../../dbLock/dbLock");
const { toggleLock } = require("../../dbLock/toggleLock");
const { getDepositsTable } = require("../../depositsTable");
const {
  checkEscrowBalance,
  withdrawCounter
} = require("../../checkEscrowBalance");
const admin = require("../../admin");

module.exports.withdraw = async ctx => {
  let msg = "";
  const args = ctx.state.command.splitArgs;

  if (args.length == 2) {
    //check amount and address
    const withdrawLimit = process.env.WITHDRAW_LIMIT;
    const withdrawMaximum = process.env.WITHDRAW_MAXIMUM;
    const withdrawDelayTime = process.env.WITHDRAW_DELAY_TIME;
    const amount = +args[0];
    const destSLPaddr = args[1];

    try {
      await dbLock(ctx, ctx.from.id);
    } catch (err) {
      console.log("withdraw:: dbLock error:", err);
      return `*${ctx.from.first_name}* sorry, try later.`;
    }

    const session = await getSession(ctx.from.id);
    const wallet = session.wallet;
    let delta;

    if (session.lastWithdraw) {
      delta = (Date.now() - session.lastWithdraw) / 60000;
    } else {
      delta = withdrawDelayTime;
    }

    if (
      Number.isInteger(amount) &&
      wallet.tkfPoints >= amount &&
      amount >= withdrawLimit &&
      amount <= withdrawMaximum &&
      delta >= withdrawDelayTime
    ) {
      // Typing action while wait transaction processing
      ctx.replyWithChatAction("typing");

      const withdrawResult = await withdrawValidation(
        ctx,
        session,
        amount,
        destSLPaddr
      );

      console.log(withdrawResult);
      msg += withdrawResult;
    } else {
      if (amount < withdrawLimit) {
        msg += `The minimum withdrawal is : ${withdrawLimit} TKF💰`;
      } else if (wallet.tkfPoints < amount) {
        //Not enough
        msg += `You don't have enough tokens, you have : ${wallet.tkfPoints} TKF💰`;
      } else if (delta < withdrawDelayTime) {
        const left = (withdrawDelayTime - delta).toFixed(2);
        msg += `Sorry, you can't withdraw tokens during: ${left} min.\nPlease wait.`;
      } else if (amount > withdrawMaximum) {
        msg += `Sorry, you can't withdraw more than ${withdrawMaximum} tokens.`;
      } else {
        //Wrong amount
        msg += `Wrong amount: ${args[0]}`;
      }
    }

    toggleLock(ctx, ctx.from.id);
  } else {
    // Wrong command format! to withdraw tokens use follow format
    msg += `
📤*HOW TO WITHDRAW*📤\nTo withdraw tokens the proper syntax is:\n\n*/withdraw "amount" "simpleledger address"*
\n\nExample:\n\n/withdraw 10 simpleledger:123456abcdefg123456abcdefg123456abcdefg`;
  }

  ctx.replyWithMarkdown(msg);
};

const withdrawTokens = async (session, amount, destSLPaddr) => {
  // Main withdraw process
  // Update Session Balance

  session.wallet.tkfPoints -= amount;
  session.lastWithdraw = Date.now();
  await saveSession(session.from.id, session);
  try {
    await sendToken(amount, destSLPaddr);
    await withdrawCounter();
    return true;
  } catch (err) {
    console.log("Withdraw error at sendToken.js :\n", err);
    return;
  }
};

const withdrawValidation = async (ctx, session, amount, destSLPaddr) => {
  // Check SLP address
  const isSLPAddr = await checkSLPAddress(destSLPaddr);

  // WITHDRAW TO BOT's USER DEPOSIT ADDRESS - DEPRECATED
  // Need to check that destSLPaddr doesn't exists in AWS_DYNAMODB_DEPOSITS_TABLE
  const isAddrExists = await getDepositsTable(destSLPaddr);

  if (isAddrExists) {
    console.log("Destination address exists in deposits table: ", destSLPaddr, JSON.stringify(isAddrExists.Item));
    return `Sorry! We can't process this transaction.`;
  }

  if (isSLPAddr) {
    // Need to check escrow balance
    const balances = await checkEscrowBalance();
    const tokenBalance = balances.tokens;
    const bchBalance = balances.bchBalance;
    console.log("Escrow balance:\n", JSON.stringify(balances, null, 2));

    if (tokenBalance < amount) {
      // Escrow wallet doesn't have enough HONK tokens to make transaction
      let warnMsg =
        "ALERT! Escrow wallet doesn't have enough TKF tokens to make transaction";
      warnMsg += `\nEscrow balance: ${tokenBalance} TKF; Amount: ${amount}`;
      admin.alert(ctx, warnMsg);
      console.log(warnMsg);
      return `Sorry! We currently can't process this transaction. Please try later.`;
    } else if (bchBalance < process.env.MINIMUM_ESCROW_BALANCE) {
      // Escrow wallet doesn't have enough BCH to pay for transaction FEE
      let warnMsg =
        "ALERT! Escrow wallet doesn't have enough BCH to pay for transaction FEE";
      admin.alert(ctx, warnMsg);
      console.log(warnMsg);
      return `Sorry! We currently can't process this transaction. Please try later.`;
    }

    admin.notification(ctx, balances);
    // Final withdraw
    const withdrawResult = await withdrawTokens(session, amount, destSLPaddr);

    if (withdrawResult) {
      return `Successfuly withdraw *${amount}* *TKF* to SLPaddress:\n*${destSLPaddr}*`;
    } else {
      // If withdraw transaction failed return tokens back
      prevSession = await getSession(session.from.id);
      prevSession.wallet.tkfPoints += amount;
      await saveSession(prevSession.from.id, prevSession);
      return `Sorry! We can't process this transaction. Please try later.`;
    }
  } else {
    return `Wrong SLP address! Check your address:\n*${destSLPaddr}*`;
  }
};
