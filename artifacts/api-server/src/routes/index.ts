import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walkRouter from "./walk";
import statusRouter from "./status";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walkRouter);
router.use(statusRouter);

export default router;
