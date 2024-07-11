import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import JsonRpc from 'json-rpc-2.0';
import { rpc } from './rpc.js';
import { SERVER_PORT } from './const.js';
import { getMoveHash } from './db.js';
const { JSONRPCServer, createJSONRPCErrorResponse } = JsonRpc;
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = new JSONRPCServer();
for (const [key, value] of Object.entries(rpc)) {
    server.addMethod(key, value);
}
// error handler
server.applyMiddleware(async function (next, request, serverParams) {
    try {
        return await next(request, serverParams);
    } catch (error) {
        const message = typeof error === 'string' ? error : error?.message || 'Internal error';
        const err = createJSONRPCErrorResponse(request.id, error?.code || -32000, message, {
            message,
        });
        return err;
    }
});

app.get('/v1/move_hash', async function (req, res, next) {
    const hash = req.query?.hash?.toLowerCase() ?? '0x1';
    const move_hash = await getMoveHash(hash);
    res.status(200).json({
        data: move_hash,
    });
});

app.use('/', async function (req, res, next) {
    const context = {
        token: req.headers["token"] || null, // for faucet google recaptcha token
        ip: req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip,
    };
    // console.log('>>> %s %s %s', context.ip, req.body.method);
    let str_req = `<<< ${JSON.stringify(req.body)}`;
    server.receive(req.body, context).then(jsonRPCResponse => {
        if (jsonRPCResponse.error) {
            // console.error(str_req, jsonRPCResponse);
        } else {
            // console.log(str_req, jsonRPCResponse);
        }
        if (Array.isArray(req.body) && req.body.length === 1) {
            res.json([jsonRPCResponse]);
        } else {
            res.json(jsonRPCResponse);
        }
    });
});

app.set('trust proxy', 1);
app.listen(SERVER_PORT, () => {
    console.log('server start at http://127.0.0.1:' + SERVER_PORT);
});
import('./task.js');
