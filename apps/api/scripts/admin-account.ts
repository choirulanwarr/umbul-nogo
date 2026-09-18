import { loginRequestSchema } from "@umbul-nogo/contracts/auth";
import { createDatabase, databaseUrl } from "../src/db/client";
import { AccountOperationError, manageAccount } from "../src/operator/accounts";
import { prompt } from "../src/operator/prompt";

async function main(): Promise<void> {
  const [action, ...extra] = process.argv.slice(2);
  if (extra.length || (action !== "create" && action !== "reset" && action !== "disable"))
    throw new AccountOperationError(
      "Gunakan admin:account create|reset|disable tanpa argumen lain.",
    );
  const url = databaseUrl(process.env.MIGRATION_DATABASE_URL, "umbul_migrator");
  const email = loginRequestSchema.shape.email.parse(await prompt("Email akun: "));
  let password = "";
  if (action !== "disable") {
    password = loginRequestSchema.shape.password.parse(
      await prompt("Password baru (15–128 karakter): ", true),
    );
    if (password !== (await prompt("Ulangi password: ", true)))
      throw new AccountOperationError("Konfirmasi password tidak sama.");
  }
  const description =
    action === "reset"
      ? "reset, aktifkan akun, dan cabut seluruh sesi"
      : action === "disable"
        ? "nonaktifkan akun dan cabut seluruh sesi"
        : "buat akun";
  if ((await prompt(`${description} ${email}? Ketik YA: `)) !== "YA")
    throw new AccountOperationError("Operasi dibatalkan.");
  const connection = createDatabase(url, "umbul_migrator");
  try {
    const result = await manageAccount(
      connection.db,
      action === "disable" ? { action, email } : { action, email, password },
    );
    console.info(JSON.stringify(result));
  } finally {
    password = "";
    await connection.close();
  }
}
try {
  await main();
} catch (error) {
  console.error(
    JSON.stringify({
      event: "operator.account.failed",
      message:
        error instanceof AccountOperationError
          ? error.message
          : "Operasi gagal atau input dibatalkan. Periksa input, terminal, dan koneksi database.",
    }),
  );
  process.exitCode = 1;
}
