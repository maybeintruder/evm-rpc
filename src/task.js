import { getTransactionReceipt } from './bridge.js';
import { Block2Hash, GLobalState, RawTx, TxEvents } from './db.js';
import { sleep } from './helper.js';
import { Op } from 'sequelize';
import { getRequest } from './provider.js';
async function saveEvents(tx) {
    const receipt = await getTransactionReceipt(tx);
    let logs = receipt.logs;
    if (logs.length > 0) {
        logs = logs.map(log => {
            const {
                address,
                topics,
                data,
                blockNumber,
                transactionHash,
                transactionIndex,
                blockHash,
                logIndex,
            } = log;
            return {
                logIndex,
                blockNumber: parseInt(blockNumber.slice(2), 16),
                blockHash,
                transactionHash,
                transactionIndex,
                address,
                data: data || '0x',
                topics: JSON.stringify(topics),
                topic0: topics[0] || '',
                topic1: topics[1] || '',
                topic2: topics[2] || '',
                topic3: topics[3] || '',
            };
        });
        await TxEvents.bulkCreate(logs);
    }
}
let latest_sync_event_tx_id = -1;
async function syncTxEvents() {
    const KEY = 'latestSyncEventTx';
    if (latest_sync_event_tx_id === -1) {
        const latestTx = await GLobalState.findOne({
            where: {
                key: KEY,
            },
        });
        if (!latestTx) {
            await GLobalState.create({
                key: KEY,
                value: '0',
            });
            return;
        }
        latest_sync_event_tx_id = parseInt(latestTx.value);
    }
    const nextTx = await RawTx.findOne({
        attributes: ['id', 'hash'],
        where: {
            id: {
                [Op.gt]: latest_sync_event_tx_id,
            },
        },
    });
    if (nextTx) {
        await saveEvents(nextTx.hash);
        await GLobalState.update(
            {
                value: nextTx.id,
            },
            {
                where: {
                    key: KEY,
                },
            },
        );
        latest_sync_event_tx_id = parseInt(nextTx.id);
    } else {
        await sleep(1);
    }
}
async function startSyncEventsTask() {
    while (true) {
        try {
            await syncTxEvents();
        } catch (e) {
            console.log('sync tx events error', e);
        }
        await sleep(0.1);
    }
}

async function syncTxBlock2hash() {
    const block_info = await Block2Hash.findAll({
        order: [['id', 'DESC']],
        limit: 100,
        attributes: ['id'],
    });
    let start_block = 0;
    if (block_info.length > 0) {
        start_block = Math.max(...block_info.map(it => it.id));
    }
    start_block++;
    // the max limit is 100
    const query = `/accounts/0x1/events/0x1::block::BlockResource/new_block_events?limit=100&start=${start_block}`;
    const res = await getRequest(query);
    const blocks = res
        .map(it => {
            return {
                id: +it.data.height,
                hash: it.data.hash,
            };
        })
        .filter(it => it.id >= start_block)
        // Must sort , for we think the latest block is the last one
        .sort((a, b) => a.id - b.id);
    if (blocks.length > 0) {
        // console.log('found block info', blocks);
        await Block2Hash.bulkCreate(blocks);
    } else {
        await sleep(1);
    }
}

async function startSyncBlockTask() {
    while (true) {
        try {
            await syncTxBlock2hash();
        } catch (e) {
            console.log('sync block info error', e);
        }
        await sleep(0.1);
    }
}
startSyncBlockTask();
startSyncEventsTask();
