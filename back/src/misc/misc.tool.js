import { customAlphabet } from 'nanoid'
const alphabet = 'abcdefghjkmnpqrstuvwxyz123456789' // remove o,l,i,... to avoid confusion
const nanoid = customAlphabet(alphabet, 4); // 4 characters

export default {
    nanoid,
}
