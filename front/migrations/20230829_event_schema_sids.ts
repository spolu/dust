import { EventSchema } from "@app/lib/models/extract";
import { new_id } from "@app/lib/utils";

async function main() {
  const chunks = [];
  const schemas = await EventSchema.findAll();
  for (let i = 0; i < schemas.length; i += 16) {
    chunks.push(schemas.slice(i, i + 16));
  }
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i}/${chunks.length}...`);
    const chunk = chunks[i];
    await Promise.all(
      chunk.map((m) => {
        return (async () => {
          if (!m.sId) {
            const sId = new_id();
            await m.update({
              sId: sId.slice(0, 10),
            });
          }
        })();
      })
    );
  }
}

main()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
