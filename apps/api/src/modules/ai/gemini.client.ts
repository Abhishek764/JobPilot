import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';

import { env } from '../../config/env';

const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);

export const getModel = (model = env.GEMINI_MODEL): GenerativeModel => client.getGenerativeModel({ model });
