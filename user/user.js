import { tokenExists, getBalance } from "../db/database.js";

export function checkToken(token) {
    return (!(!token || !tokenExists(token)))
}

export function checkValidBet(token, betAmount) {
    const currentBalance = getBalance(token);
    console.log(`betAmount: ${betAmount}; currentBalance: ${currentBalance}`)
    return (betAmount > 0 && currentBalance && betAmount <= currentBalance);
}