const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionFlagsBits,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

const { joinVoiceChannel } = require("@discordjs/voice");

const express = require("express");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Discord Destek Botu aktif!");
});

app.listen(PORT, () => {
  console.log(`Web sunucusu ${PORT} portunda çalışıyor.`);
});

// ===============================
// DESTEK KATEGORİLERİ
// ===============================

const categories = {
  oyun: {
    label: "Oyun Destek",
    description: "Oyun içi yaşadığınız sorunlar için destek alın.",
    emoji: { id: "1538871611304714300", name: "tta" }, // Select menu için özel emoji objesi
    roles: ["Ordu Generali", "Kıdemli Ordu Generali"]
  },

  discord: {
    label: "Discord Destek",
    description: "Discord sunucusu ile ilgili destek alın.",
    emoji: { id: "1523943016094634014", name: "moderatrekibi" }, // Select menu için özel emoji objesi
    roles: ["Moderatör Ekibi"]
  },

  gamepass: {
    label: "Gamepass Destek",
    description: "Gamepass işlemleri hakkında destek alın.",
    emoji: "🎟️",
    roles: ["Ordu Generali", "Kıdemli Ordu Generali"]
  }
};

// ===============================
// BOT HAZIR
// ===============================

client.once("ready", async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı.`);

  for (const guild of client.guilds.cache.values()) {

    // ===============================
    // SES KANALINA OTOMATİK GİR
    // ===============================

    if (guild.id === "1402595780447043664") {

      const voiceChannel = guild.channels.cache.get(
        "1538526452545364008"
      );

      if (voiceChannel && voiceChannel.type === ChannelType.GuildVoice) {

        joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guild.id,
          adapterCreator: guild.voiceAdapterCreator,
          selfDeaf: false,
          selfMute: false
        });

        console.log(
          `${guild.name}: Ses kanalına bağlandı.`
        );

      } else {

        console.log(
          `${guild.name}: Ses kanalı bulunamadı.`
        );

      }
    }

    // destek-sistemi kanalını bul
    const channel = guild.channels.cache.find(
      c =>
        c.name === "destek-sistemi" &&
        c.type === ChannelType.GuildText
    );

    if (!channel) {
      console.log(
        `${guild.name}: #destek-sistemi bulunamadı.`
      );
      continue;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🎫 TTA Destek Sistemi")
      .setDescription(
        "Aşağıdaki menüden ihtiyacınıza uygun destek kategorisini seçerek ticket oluşturabilirsiniz.\n\n" +

        "**📌 Nasıl çalışır?**\n" +
        "• İhtiyacınız olan kategoriyi seçin.\n" +
        "• Size özel bir ticket kanalı oluşturulur.\n" +
        "• İlgili yetkili ekip ticketınızı görecektir.\n" +
        "• İşiniz bittiğinde ticketı kapatabilirsiniz.\n\n" +

        "<:tta:1538871611304714300> **Oyun Destek**\n" +
        "Oyun içerisindeki sorunlarınız için.\n\n" +

        "<:moderatrekibi:1523943016094634014> **Discord Destek**\n" +
        "Discord sunucusu ile ilgili sorunlarınız için.\n\n" +

        "**🎟️ Gamepass Destek**\n" +
        "Gamepass işlemleriniz için."
      )
      .setFooter({
        text: "TTA • Destek Sistemi"
      });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Destek kategorisi seçin...")
      .addOptions(
        Object.entries(categories).map(
          ([value, category]) => ({
            label: category.label,
            description: category.description,
            value: value,
            emoji: category.emoji
          })
        )
      );

    const row = new ActionRowBuilder()
      .addComponents(menu);

    // Eski paneli bul
    const messages = await channel.messages.fetch({
      limit: 50
    });

    const oldPanel = messages.find(
      msg =>
        msg.author.id === client.user.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].title === "🎫 TTA Destek Sistemi"
    );

    if (oldPanel) {

      await oldPanel.edit({
        embeds: [embed],
        components: [row]
      });

    } else {

      await channel.send({
        embeds: [embed],
        components: [row]
      });

    }
  }
});

// ===============================
// TICKET OLUŞTURMA
// ===============================

client.on("interactionCreate", async interaction => {

  if (!interaction.isStringSelectMenu()) return;

  if (interaction.customId !== "ticket_category") return;

  const guild = interaction.guild;
  const user = interaction.user;

  // Kullanıcının açık ticketı var mı?
  const existingTicket = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic === `ticket:${user.id}`
  );

  if (existingTicket) {

    return interaction.reply({
      content:
        `❌ Zaten açık bir ticketın var: ${existingTicket}`,
      ephemeral: true
    });

  }

  const selected = interaction.values[0];

  const categoryInfo = categories[selected];

  if (!categoryInfo) {

    return interaction.reply({
      content: "❌ Geçersiz destek kategorisi.",
      ephemeral: true
    });

  }

  // ===============================
  // TICKETLER KATEGORİSİ
  // ===============================

  const ticketCategory = guild.channels.cache.find(
    channel =>
      channel.name === "🚪 Sunucu Kapısı" &&
      channel.type === ChannelType.GuildCategory
  );

  if (!ticketCategory) {

    return interaction.reply({
      content:
        "❌ Sunucuda `🚪 Sunucu Kapısı` adında kategori bulunamadı.",
      ephemeral: true
    });

  }

  // ===============================
  // ROLLERİ BUL
  // ===============================

  const supportRoles = [];

  for (const roleName of categoryInfo.roles) {

    const role = guild.roles.cache.find(
      r => r.name === roleName
    );

    if (role) {
      supportRoles.push(role);
    }
  }

  if (supportRoles.length === 0) {

    return interaction.reply({
      content:
        `❌ Bu kategori için gerekli roller bulunamadı.\n\nRoller: ${categoryInfo.roles.join(", ")}`,
      ephemeral: true
    });

  }

  // ===============================
  // İZİNLER
  // ===============================

  const permissionOverwrites = [

    {
      id: guild.roles.everyone.id,

      deny: [
        PermissionFlagsBits.ViewChannel
      ]
    },

    {
      id: user.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]
    }

  ];

  // Yetkili rollerine izin ver
  for (const role of supportRoles) {

    permissionOverwrites.push({

      id: role.id,

      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory
      ]

    });

  }

  // ===============================
  // TICKET KANALI
  // ===============================

  const ticketChannel =
    await guild.channels.create({

      name:
        `${selected}-${user.username}`
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, ""),

      type: ChannelType.GuildText,

      parent: ticketCategory.id,

      topic: `ticket:${user.id}`,

      permissionOverwrites:
        permissionOverwrites

    });

  // ===============================
  // ROL ETİKETLERİ
  // ===============================

  const roleMentions =
    supportRoles
      .map(role => `<@&${role.id}>`)
      .join(" ");

  // ===============================
  // TICKET EMBED
  // ===============================

  const embed = new EmbedBuilder()

    .setColor(0x5865F2)

    .setTitle(
      `${categoryInfo.emoji} ${categoryInfo.label}`
    )

    .setDescription(
      `Merhaba ${user}!\n\n` +

      `Destek talebin başarıyla oluşturuldu.\n\n` +

      `**📂 Kategori:** ${categoryInfo.label}\n` +

      `**👤 Kullanıcı:** ${user}\n\n` +

      `Yetkili ekip en kısa sürede seninle ilgilenecektir.\n\n` +

      `🔒 İşiniz bittiğinde aşağıdaki **Ticket Kapat** butonuna basabilirsiniz.`
    )

    .setFooter({
      text: "TTA • Destek Sistemi"
    });

  // ===============================
  // KAPAT BUTONU
  // ===============================

  const closeButton =
    new ButtonBuilder()

      .setCustomId("close_ticket")

      .setLabel("Ticket Kapat")

      .setEmoji("🔒")

      .setStyle(ButtonStyle.Danger);

  const row =
    new ActionRowBuilder()
      .addComponents(closeButton);

  // ===============================
  // MESAJI GÖNDER
  // ===============================

  await ticketChannel.send({

    content:
      `${user} ${roleMentions}`,

    embeds: [embed],

    components: [row]

  });

  await interaction.reply({

    content:
      `✅ Ticketın oluşturuldu: ${ticketChannel}`,

    ephemeral: true

  });

});

// ===============================
// TICKET KAPATMA
// ===============================

client.on("interactionCreate", async interaction => {

  if (!interaction.isButton()) return;

  if (interaction.customId !== "close_ticket") return;

  const channel = interaction.channel;

  await interaction.reply(
    "🔒 Ticket **5 saniye içinde kapatılıyor...**"
  );

  setTimeout(async () => {

    await channel.delete().catch(() => {});

  }, 5000);

});

// ===============================
// BOT TOKEN
// ===============================

client.login(process.env.DISCORD_TOKEN);
  
