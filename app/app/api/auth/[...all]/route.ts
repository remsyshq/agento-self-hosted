import { toNextJsHandler } from 'better-auth/next-js';
import { getAuth } from '../../../../server-auth';

const auth = getAuth();
export const { GET, POST } = toNextJsHandler(auth);
