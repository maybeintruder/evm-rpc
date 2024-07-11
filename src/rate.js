import { JSONFilePreset } from 'lowdb/node';
const db = await JSONFilePreset(`faucet.limiter.json`, []);
const limit = 24 * 60 * 60 * 1000;

export async function canRequest(key) {
    const user = await db.data.find(it => it.key === key);
    if (user) {
        if (Date.now() - user.time < limit) {
            return [false, Math.floor((limit - (Date.now() - user.time)) / 1000)];
        }
        return [true, 0];
    }
    return [true, 0];
}

export async function setRequest(key) {
    await db.update(users => {
        const item = users.find(it => it.key === key);
        if (item) {
            item[key] = Date.now();
        } else {
            users.push({ key, time: Date.now() });
        }
    });
}

async function test() {
    await console.log(canRequest('0x1234567890abcdef'));
    await setRequest('0x1234567890abcdef');
    await console.log(canRequest('0x1234567890abcdef'));
    await console.log(canRequest('0x1234567890aef'));
    await setRequest('0x1234567890aef');
    await console.log(canRequest('0x1234567890aef'));
}
