import { writeFile } from 'fs/promises'
import { Case } from './main'

export function writeCase(indexFile: number, cases: Case[]): Promise<void> {
    return writeFile(`./geipan${indexFile}.json`, JSON.stringify(cases));
}