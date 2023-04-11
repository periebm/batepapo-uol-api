import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 5000;


app.post("/participants", (req, res)=>{
    res.send("ok");
})

app.get("/participants", (req, res) =>{
    res.send("OK");
})

app.post("/messages",(req,res)=>{
    res.send("OK");
})

app.get("/messages", (req,res)=>{
    res.send("OK");
})

app.post("/status",(req,res)=>{
    res.send("OK");
})

app.listen(PORT);


