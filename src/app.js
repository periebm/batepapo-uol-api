import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

//Create server app
const app = express();

//Config
app.use(cors());
app.use(express.json());
dotenv.config();

//Conect to database
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

//{name: 'João', lastStatus: 12313123} // O conteúdo do lastStatus será explicado nos próximos requisitos

//{from: 'João', to: 'Todos', text: 'oi galera', type: 'message', time: '20:04:37'}


// Endpoints


app.post("/participants", async (req, res) => {
    const { name } = req.body;

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

        await db.collection("participants").insertOne({ name: name, lastStatus: Date.now() })
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

app.delete("/participants", async (req, res) => {
    try {
        const r = await db.collection("messages").deleteMany({})
        res.send("Deletado");
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body
    const from = req.headers.user

    const msgSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    })

    const validation = msgSchema.validate(req.body, { abortEarly: false })
    if (validation.error) {
        console.log(validation.error)
        return res.sendStatus(422)
    }

    try {
        const participant = await db.collection("participants").findOne({ name: from });
        if (!participant) return res.status(422).send("Usuario nao esta na sala.")

        const msg = await db.collection("messages").insertOne({
            from: from,
            to: to,
            text: text,
            type: type,
            time: `${dayjs().format('HH:mm:ss')}` //"HH:mm:ss"
        })

        res.sendStatus(201);
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.get("/messages", async(req, res) => {

    try {
        const msgs = await db.collection("messages").find().toArray();
        res.send(msgs);
    } catch (err) {
        res.status(500).send(err.message)
    }
})

app.post("/status", (req, res) => {
    res.send("OK");
})

app.listen(PORT, () => console.log(`Server running in PORT ${PORT}`));


