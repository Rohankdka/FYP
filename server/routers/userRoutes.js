import express from "express";
import authToken from "../middleware/authToken.js";
import authorizeRoles from "../middleware/roleMiddleware.js";

const router = express.Router();

router.get("/admin",authToken,authorizeRoles("admin"),(req,res)=>{
    res.json({message:"Welcome Admin"})
})
router.get("/passenger",authToken,authorizeRoles("passenger"), (req,res)=>{
    res.json({message:"Welcome passenger"})
})
router.get("/driver",authToken,authorizeRoles("driver"),(req,res)=>{
    res.json({message:"Welcome Driver"})
})

export default router;
