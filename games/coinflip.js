// returns win/lose boolean and reward amount
export function playCoinflip(betAmount) {
    const win = Math.random() < 0.5;
    const change = win ? 2*betAmount : -betAmount;
    return {
        result: win ? "win" : "lose",
        change
    }
}