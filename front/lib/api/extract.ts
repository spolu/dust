import { Authenticator } from "@app/lib/auth";
import { isDevelopmentOrDustWorkspace } from "@app/lib/development";
import { EventSchema, ExtractedEvent } from "@app/lib/models";
import { new_id } from "@app/lib/utils";
import { EventSchemaType, ExtractedEventType } from "@app/types/extract";

export async function getEventSchemas(
  auth: Authenticator
): Promise<EventSchemaType[]> {
  const owner = auth.workspace();
  if (!owner) {
    return [];
  }

  const schemas = await EventSchema.findAll({
    where: {
      workspaceId: owner.id,
    },
    order: [["marker", "ASC"]],
  });

  return schemas.map((schema): EventSchemaType => {
    return {
      id: schema.id,
      marker: schema.marker,
      description: schema.description,
      status: schema.status,
      properties: schema.properties,
    };
  });
}

export async function getEventSchema(
  auth: Authenticator,
  marker: string
): Promise<EventSchemaType | null> {
  const owner = auth.workspace();
  if (!owner) {
    return null;
  }

  const schema = await EventSchema.findOne({
    where: {
      marker: marker,
      workspaceId: owner.id,
    },
  });

  if (!schema) {
    return null;
  }

  return {
    id: schema.id,
    marker: schema.marker,
    description: schema.description,
    status: schema.status,
    properties: schema.properties,
  };
}

export async function createEventSchema(
  auth: Authenticator,
  marker: string,
  description: string,
  properties: []
): Promise<EventSchemaType | void> {
  const owner = auth.workspace();
  const user = auth.user();
  if (!owner || !user) {
    return;
  }

  const sId = new_id();
  const schema = await EventSchema.create({
    sId: sId.slice(0, 10),
    marker: marker,
    description: description,
    properties: properties,
    status: "active",
    workspaceId: owner.id,
    debug: isDevelopmentOrDustWorkspace(owner), // @todo Daph schema_debug_feature
    userId: user.id,
  });

  return {
    id: schema.id,
    marker: schema.marker,
    description: schema.description,
    status: schema.status,
    properties: schema.properties,
  };
}

export async function updateEventSchema(
  auth: Authenticator,
  marker: string,
  newMarker: string,
  newDescription: string,
  newProperties: []
): Promise<EventSchemaType | void> {
  const owner = auth.workspace();
  if (!owner) {
    return;
  }

  const schema = await EventSchema.findOne({
    where: {
      marker: marker,
      workspaceId: owner.id,
    },
  });

  if (!schema) {
    return;
  }

  await schema.update({
    marker: newMarker,
    description: newDescription,
    properties: newProperties,
  });

  return {
    id: schema.id,
    marker: schema.marker,
    description: schema.description,
    status: schema.status,
    properties: schema.properties,
  };
}

export async function getExtractedEvent({
  auth,
  marker,
  eId,
}: {
  auth: Authenticator;
  marker: string;
  eId: string;
}): Promise<ExtractedEventType | null> {
  const owner = auth.workspace();
  if (!owner) {
    return null;
  }
  const schema = await EventSchema.findOne({
    where: {
      marker: marker,
      workspaceId: owner.id,
    },
  });

  if (!schema) {
    return null;
  }

  const event = await ExtractedEvent.findOne({
    where: {
      id: eId,
      eventSchemaId: schema.id,
    },
  });

  if (!event) {
    return null;
  }

  return {
    id: event.id,
    marker: event.marker,
    properties: event.properties,
    dataSourceName: event.dataSourceName,
    documentId: event.documentId,
    documentSourceUrl: event.documentSourceUrl,
  };
}

export async function getExtractedEvents({
  auth,
  marker,
}: {
  auth: Authenticator;
  marker: string;
}): Promise<ExtractedEventType[]> {
  const owner = auth.workspace();
  if (!owner) {
    return [];
  }

  const schema = await EventSchema.findOne({
    where: {
      marker: marker,
      workspaceId: owner.id,
    },
  });

  if (!schema) {
    return [];
  }

  const events = await ExtractedEvent.findAll({
    where: {
      eventSchemaId: schema.id,
    },
    order: [["createdAt", "DESC"]],
  });

  return events.map((event): ExtractedEventType => {
    return {
      id: event.id,
      marker: event.marker,
      properties: event.properties,
      dataSourceName: event.dataSourceName,
      documentId: event.documentId,
      documentSourceUrl: event.documentSourceUrl,
    };
  });
}

export async function deleteExtractedEvent({
  auth,
  eId,
}: {
  auth: Authenticator;
  eId: string;
}): Promise<boolean> {
  const owner = auth.workspace();
  if (!owner) {
    return false;
  }

  const event = await ExtractedEvent.findOne({
    where: {
      id: eId,
    },
  });
  if (!event) {
    return false;
  }

  await event.destroy();
  return true;
}
