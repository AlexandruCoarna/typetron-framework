import { Database } from 'sqlite3'
import { SqlValue } from '@Typetron/Database/Types'
import { DatabaseDriver } from '../DatabaseDriver'
import { Create } from '../SQL/Statements/Create'
import { Select } from '../SQL/Statements/Select'
import { Insert } from '../SQL/Statements/Insert'
import { Delete } from '../SQL/Statements/Delete'
import { Update } from '../SQL/Statements/Update'
import { Alter } from '../SQL/Statements/Alter'
import { Schema } from './Schema'
import { SchemaContract } from '@Typetron/Database/Drivers/SchemaContract'
import { wrap } from '@Typetron/Database/Helpers'

export class SqliteDriver implements DatabaseDriver {
    database: Database

    schema: SchemaContract = new Schema(this)

    statements = {
        create: Create,
        select: Select,
        insert: Insert,
        delete: Delete,
        update: Update,
        alter: Alter,
    }

    constructor(databaseFilePath: string) {
        this.database = new Database(databaseFilePath)
    }

    async run(query: string, params: SqlValue[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            const appError = new Error()
            this.database.run(query, params, error => {
                if (error) {
                    return reject(this.buildError(appError, error, query))
                }

                resolve()
            })
        })
    }

    async insertOne(query: string, params: SqlValue[] = []): Promise<number> {
        await this.run(query, params)
        return this.lastInsertedId()
    }

    async truncate(table: string) {
        return this.run(`DELETE FROM ${table}`)
    }

    async lastInsertedId(): Promise<number> {
        return new Promise<number>(((resolve, reject) => {
            const appError = new Error()
            const query = 'SELECT last_insert_rowid() as id;'
            this.database.get(query, [], (error, lastInsert) => {
                if (error) {
                    return reject(this.buildError(appError, error, query))
                }
                resolve(lastInsert.id)
            })
        }))
    }

    async get<T>(query: string, params: SqlValue[] = []): Promise<T[]> {
        return new Promise<T[]>((resolve, reject) => {
            const appError = new Error()
            this.database.all(query, params, (error, rows) => {
                if (error) {
                    return reject(this.buildError(appError, error, query))
                }
                resolve(rows)
            })
        })
    }

    async first<T>(query: string, params: SqlValue[] = []): Promise<T> {
        return new Promise<T>((resolve, reject) => {
            const appError = new Error()
            this.database.get(query, params, (error, row) => {
                if (error) {
                    return reject(this.buildError(appError, error, query))
                }
                resolve(row)
            })
        })
    }

    buildError(appError: Error, databaseError: Error, query?: string) {
        appError.message = `${databaseError} in '${query}' `
        // appError.stack = appError.stack?.replace('Error:', `${appError.message}`)
        return appError
    }

    tables() {
        return this.get<{name: string}>(
            `SELECT name
             FROM sqlite_master
             WHERE type = 'table'`
        )
    }

    tableExists(table: string): Promise<Boolean> {
        return this.first(
            `SELECT *
             FROM sqlite_master
             WHERE name = ?`,
            [table]
        )
    }

    tableColumns(table: string) {
        return this.get<{name: string, type: string}>(`PRAGMA table_info(${wrap(table)})`)
    }
}
