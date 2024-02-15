import type { Attributes, Model, ModelStatic } from "sequelize";

interface BaseResourceConstructor<T extends BaseResource<M>, M extends Model> {
  new (model: ModelStatic<M>, blob: Attributes<M>): T;
}

/**
 * BaseResource serves as a foundational class for resource management.
 * It encapsulates common CRUD operations for Sequelize models, ensuring a uniform interface
 * across different resources. Each instance represents a specific database row, identified by `id`.
 * - `fetchById`: Static method to retrieve an instance based on its ID, ensuring type safety and
 *   the correct model instantiation.
 * - `delete`: Instance method to delete the current resource from the database.
 * - `update`: Instance method to update the current resource with new values.
 *
 * For now, this class is designed to be extended by specific resource classes, each tied to a Sequelize model.
 */
export class BaseResource<M extends Model> {
  readonly id: number;

  constructor(readonly model: ModelStatic<M>, blob: Attributes<M>) {
    Object.assign(this, blob);

    this.id = blob.id;
  }

  static async fetchById<T extends BaseResource<M>, M extends Model>(
    this: BaseResourceConstructor<T, M> & {
      model: ModelStatic<M>;
    },
    id: number | string
  ): Promise<T | null> {
    const parsedId = typeof id === "string" ? parseInt(id, 10) : id;
    // Use `raw: true` to avoid the nested level with `dataValues`.
    const blob = await this.model.findByPk(parsedId);
    if (!blob) {
      return null;
    }

    // Use `.get` to extract model attributes, omitting Sequelize instance metadata.
    return new this(this.model, blob.get());
  }

  async delete(): Promise<number> {
    return this.model.destroy({
      // @ts-expect-error TS cannot infer the presence of 'id' in Sequelize models, but our models always include 'id'.
      where: {
        id: this.id,
      },
    });
  }

  async update(
    blob: Partial<Attributes<M>>
  ): Promise<[affectedCount: number, affectedRows: M[]]> {
    return this.model.update(blob, {
      // @ts-expect-error TS cannot infer the presence of 'id' in Sequelize models, but our models always include 'id'.
      where: {
        id: this.id,
      },
    });
  }
}
