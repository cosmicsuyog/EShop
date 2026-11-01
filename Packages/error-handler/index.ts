export class AppError extends Error {
    public readonly statusCode :number;
    public readonly isOperational:boolean;
    public readonly details?: any;


    constructor(message:string,statusCode:number,isOperational =true , details?:any){
        super(message);
        this.statusCode=statusCode;
        this.isOperational =isOperational;
        this.details=details;
        Error.captureStackTrace(this)
    }
}


//  Not found error


export class NotFoundError extends AppError {
    constructor(message = 'Resource not found' , details?:any){
        super(message,404,details);
    }
}

// validation Error (use for zod)

export class ValidationError extends AppError{
    constructor(message="Invalid request data",details?:any){
        super(message,400,true,details);
    }
} 

// Authentication Error

export class AuthError extends AppError{
    constructor(message="Unauthorized"){
        super(message,401)
    };
}


export class ForbiddenError extends AppError{
    constructor(message="Forbidden"){
        super(message,403)
    };
}

export class ConflictError extends AppError{
    constructor(message="Resource already exists"){
        super(message,409)
    };
}


export class DatabaseError extends AppError{
    constructor(message = "Database error",details?: any){
        super(message,500,true,details);
    }
}


export class RateLimitError extends AppError {
    constructor(message = "Too many requests, please tryr again later"){
    super(message,429)
}
}