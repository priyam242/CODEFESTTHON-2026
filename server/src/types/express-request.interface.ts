import { Request } from 'express';

export interface ExpressRequest extends Request {
  file?: Express.Multer.File;
}
