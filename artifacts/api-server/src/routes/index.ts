import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walkRouter from "./walk";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walkRouter);

export default router;
