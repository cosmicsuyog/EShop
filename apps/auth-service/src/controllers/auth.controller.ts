// Register a new user 

import { NextFunction, Request, Response } from "express";
import { validationRegistrationData } from "../utils/auth.helper";
import prisma from "Packages/libs/prisma";
import { ValidationError } from "@eshop/error-handler";
 

export const userRegistration = async (req :Request , res :Response ,next :NextFunction) =>{
    validationRegistrationData(req.body,"user")
    const {name,email}=req.body;

    const existingUser = await prisma.users.findUnique({where:email});

    if(existingUser){
        return next(new ValidationError("User already exists with this email!"));
    }
    
    await checkOtpRestrictions(email,next)
}