// Field berikut berasal dari contoh response backend yang sudah diberikan.
// Daftar field yang boleh ditulis tetap mengikuti validasi endpoint backend.
const resourceContracts = Object.freeze({
  data_siswa: Object.freeze({
    idField: "id_siswa",
    nameField: "nama_siswa",
    identifierField: "sn",
    fields: Object.freeze([
      "id_siswa", "nama_siswa", "status", "created_date", "update_date", "sn", "type",
    ]),
  }),
  data_guru: Object.freeze({
    idField: "id_guru",
    nameField: "nama",
    identifierField: "sn",
    fields: Object.freeze([
      "id_guru", "nama", "type", "created_date", "sn", "update_date",
    ]),
  }),
});

export function getResourceContract(resource) {
  if (!Object.hasOwn(resourceContracts, resource)) {
    throw new Error(`Kontrak API ${resource} belum tersedia.`);
  }
  return resourceContracts[resource];
}

// Dipakai setelah field request dari controller/validator backend diketahui.
// Tidak menambahkan nilai default, mengubah tipe, atau menjalankan request.
export function buildResourcePayload(resource, values, writableFields) {
  const contract = getResourceContract(resource);
  if (!values || typeof values !== "object" || Array.isArray(values)) {
    throw new Error("Nilai payload harus berupa objek dengan nama field backend.");
  }
  if (!Array.isArray(writableFields) || writableFields.length === 0) {
    throw new Error("Tentukan field yang boleh dikirim sesuai validasi backend.");
  }

  const payload = {};
  for (const field of writableFields) {
    if (!contract.fields.includes(field)) {
      throw new Error(`Field ${field} belum terdaftar dalam kontrak ${resource}.`);
    }
    if (Object.hasOwn(values, field) && values[field] !== undefined) {
      payload[field] = values[field];
    }
  }
  return payload;
}
