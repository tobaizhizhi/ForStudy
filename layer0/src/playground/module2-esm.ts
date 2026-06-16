import { add, version } from "./math.js";

function main(): void {
  const result = add(2, 3);

  console.log(
    JSON.stringify(
      {
        mode: "esm",
        version,
        result,
        fileUrl: import.meta.url,
      },
      null,
      2,
    ),
  );
}

main();
