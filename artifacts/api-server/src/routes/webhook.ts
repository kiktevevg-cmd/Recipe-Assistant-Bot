import { Router, type IRouter } from "express";
import { bot } from "../bot/bot.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

router.post("/webhook", (req, res) => {
  bot
    .handleUpdate(req.body)
    .then(() => {
      res.sendStatus(200);
    })
    .catch((err) => {
      logger.error({ err }, "Failed to handle Telegram webhook update");
      res.sendStatus(500);
    });
});

export default router;
