import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";
import { stripHtml } from "string-strip-html";


//Create server app =====================
const app = express();

//Config ================================
app.use(cors());
app.use(express.json());
dotenv.config();

//Connect to database ====================
const mongoClient = new MongoClient(process.env.DATABASE_URL)
try {
    await mongoClient.connect()
    console.log("MongoDB conectado!")
}
catch (err) {
    console.log(err.message)
}
const db = mongoClient.db();

const PORT = 5000;


// Endpoints ============================

const msgSchema = joi.object({
    to: joi.string().required(),
    text: joi.string().required(),
    type: joi.string().valid('message', 'private_message').required()
})


app.post("/participants", async (req, res) => {
    let { name } = req.body;

    const participantsSchema = joi.object({
        name: joi.string().required()
    })

    const validation = participantsSchema.validate(req.body, { abortEarly: false })
    if (validation.error) {
        console.log(validation.error)
        return res.sendStatus(422)
    }

    try {
        const participant = await db.collection("participants").findOne({ name: name });
        if (participant) return res.status(409).send("Usuario ja cadastrado.")

        await db.collection("participants").insertOne({ name: stripHtml(name).result.trim(), lastStatus: Date.now() })

        await db.collection("messages").insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: `${dayjs().format('HH:mm:ss')}` //"HH:mm:ss"
        })

        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants)
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.post("/messages", async (req, res) => {
    let { to, text, type } = req.body
    const from = req.headers.user

    const validation = msgSchema.validate(req.body, { abortEarly: false });
    if (validation.error) return res.sendStatus(422);

    try {
        const participant = await db.collection("participants").findOne();
        if (!participant) return res.status(422).send("Usuario nao esta na sala.");

        const msg = await db.collection("messages").insertOne({
            from: stripHtml(from).result.trim(),
            to: stripHtml(to).result.trim(),
            text: stripHtml(text).result.trim(),
            type: stripHtml(type).result.trim(),
            time: stripHtml(`${dayjs().format('HH:mm:ss')}`).result.trim()
        })

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.get("/messages", async (req, res) => {
    const user = req.headers.user;
    const limit = parseInt(req.query.limit)

    if (req.query.limit && (isNaN(limit) || limit < 1)) {
        return res.sendStatus(422);
    }

    try {
        const msgs = await db.collection("messages")
            .find({ $or: [{ to: 'Todos' }, { to: user }, { from: user }] })
            .toArray();

        if (limit) return res.send(msgs.slice(-limit).reverse());

        res.send(msgs.reverse());
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.delete("/messages/:id", async (req, res) => {
    const { id } = req.params;
    const user = req.headers.user;

    try {
        const msg = await db.collection("messages").findOne({ _id: new ObjectId(id) });
        if (!msg) return res.sendStatus(404);

        if (msg.from !== user) return res.sendStatus(401);

        await db.collection("messages").deleteOne({ _id: new ObjectId(id) })
        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message);
    }
})

app.put("/messages/:id", async (req, res) => {
    const { id } = req.params;
    let { to, text, type } = req.body;
    const user = req.headers.user;

    const validation = msgSchema.validate(req.body, { abortEarly: false });
    if (validation.error) return res.sendStatus(422);

    try {
        const participant = await db.collection("participants").findOne();
        if (!participant) return res.status(422).send("Usuario nao esta na sala.");

        const msg = await db.collection("messages").findOne({ _id: new ObjectId(id) });
        if (!msg) return res.sendStatus(404);

        if (msg.from !== user) return res.sendStatus(401);

        const result = await db.collection("receitas").updateOne(
            { _id: new ObjectId(id) },
            { $set: {
                to: stripHtml(to).result.trim(),
                text: stripHtml(text).result.trim(),
                type: stripHtml(type).result.trim(),
            }}
        )
        res.sendStatus(200);
    } catch (err) {
        res.status(500) / send(err.message);
    }
})


app.post("/status", async (req, res) => {
    const user = req.headers.user;
    if (!user) return sendStatus(404);

    try {
        const participant = await db.collection("participants").findOne({ name: user });
        if (!participant) return res.sendStatus(404);

        await db.collection("participants").updateOne({ name: user }, { $set: { name: user, lastStatus: Date.now() } });

        res.sendStatus(200);
    } catch (err) {
        res.status(500).send(err.message)
    }
})

setInterval(async () => {
    const participantsToDelete = await db.collection("participants")
        .find({ lastStatus: { $lte: (Date.now() - 10000) } })
        .toArray();

    const namesToDelete = participantsToDelete.map((n) => n.name);
    await db.collection("participants").deleteMany({ name: { $in: namesToDelete } })
    participantsToDelete.forEach(timedOut)
}, 15000)

async function timedOut(p) {
    await db.collection("messages").insertOne({
        from: p.name,
        to: 'Todos',
        text: 'sai da sala...',
        type: 'status',
        time: `${dayjs().format('HH:mm:ss')}` //"HH:mm:ss"
    })
}


app.listen(PORT, () => console.log(`Server running in PORT ${PORT}`));


