interface IPrivate {
  guildId: string; // ID сервера
  categoryId: string; // ID категории с приватками
  createVoiceIds: string[]; // ID каналов, откуда создавать приватку
  deleteTimeout: number; // Количество миллисекунд перед удалением канала
}

export const PRIVATES: IPrivate[] = [
  // Тестовый сервак
  {
    guildId: '1305286266560184360',
    categoryId: '1305286267772211382',
    createVoiceIds: [
      '1305286267772211384'
    ],
    deleteTimeout: 1500
  },
  // Боевой сервак
  {
    guildId: '805944675188867112',
    categoryId: '1276593846419197962',
    createVoiceIds: [
      '1304447989607174196'
    ],
    deleteTimeout: 500
  },
];