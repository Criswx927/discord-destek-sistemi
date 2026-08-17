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

const categories = {
  oyun: {
    label: "Oyun Destek",
    description: "Oyun içi yaşadığınız sorunlar için talep oluşturun.",
    emoji: "🎮"
  },
  discord: {
    label: "Discord Destek",
    description: "Discord sunucumuz ile ilgili talepleriniz için talep oluşturun.",
    emoji: "💬"
  },
  transfer: {
    label: "Transfer Destek",
    description: "Transfer işlemleriniz ile ilgili talep oluşturun.",
    emoji: "🔄"
  }
};

client.once("ready", async () => {
  console.log(`${client.user.tag} olarak giriş yapıldı.`);

  // Sunucudaki "destek-paneli" kanalını bul
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find(
      c => c.name === "destek-paneli" && c.type === ChannelType.GuildText
    );

    if (!channel) {
      console.log(`${guild.name}: #destek-paneli bulunamadı.`);
      continue;
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle("🎫 Destek Sistemi")
      .setDescription(
        "Aşağıdaki menüden ihtiyacınıza uygun kategoriyi seçerek destek bileti oluşturabilirsiniz.\n\n" +
        "**Nasıl çalışır?**\n" +
        "• Uygun kategoriyi seçin, sizin için özel bir kanal açılsın.\n" +
        "• Yetkili ekibimiz en kısa sürede biletinizle ilgilenecektir.\n" +
        "• Aynı anda yalnızca **1 aktif bilet** açabilirsiniz.\n\n" +
        "**Kategoriler**\n" +
        "🎮 **Oyun Destek** — Oyun içi yaşadığınız sorunlar için talep oluşturun.\n" +
        "💬 **Discord Destek** — Discord sunucumuz ile ilgili talepleriniz için talep oluşturun.\n" +
        "🔄 **Transfer Destek** — Transfer işlemleriniz ile ilgili talep oluşturun."
      )
      .setFooter({
        text: "Destek Sistemi"
      });

    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_category")
      .setPlaceholder("Destek Kategorisi Seçin...")
      .addOptions(
        Object.entries(categories).map(([value, category]) => ({
          label: category.label,
          description: category.description,
          value,
          emoji: category.emoji
        }))
      );

    const row = new ActionRowBuilder().addComponents(menu);

    // Botun eski panel mesajlarını bul
    const messages = await channel.messages.fetch({ limit: 50 });

    const oldPanel = messages.find(
      msg =>
        msg.author.id === client.user.id &&
        msg.embeds.length > 0 &&
        msg.embeds[0].title === "🎫 Destek Sistemi"
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

client.on("interactionCreate", async interaction => {
  if (!interaction.isStringSelectMenu()) return;
  if (interaction.customId !== "ticket_category") return;

  const guild = interaction.guild;
  const user = interaction.user;

  // Kullanıcının zaten ticketı var mı?
  const existingTicket = guild.channels.cache.find(
    channel =>
      channel.type === ChannelType.GuildText &&
      channel.topic === `ticket:${user.id}`
  );

  if (existingTicket) {
    return interaction.reply({
      content: `❌ Zaten açık bir ticketın var: ${existingTicket}`,
      ephemeral: true
    });
  }

  const selected = interaction.values[0];
  const categoryInfo = categories[selected];

  // TICKETLER kategorisini bul
  const ticketCategory = guild.channels.cache.find(
    channel =>
      channel.name === "TICKETLER" &&
      channel.type === ChannelType.GuildCategory
  );

  if (!ticketCategory) {
    return interaction.reply({
      content: "❌ Sunucuda `TICKETLER` adında bir kategori bulunamadı.",
      ephemeral: true
    });
  }

  // Destek rolünü bul
  const supportRole = guild.roles.cache.find(
    role => role.name === "Destek Ekibi"
  );

  if (!supportRole) {
    return interaction.reply({
      content: "❌ Sunucuda `Destek Ekibi` adında bir rol bulunamadı.",
      ephemeral: true
    });
  }

  const ticketChannel = await guild.channels.create({
    name: `${selected}-${user.username}`.toLowerCase().replace(/[^a-z0-9-_]/g, ""),
    type: ChannelType.GuildText,
    parent: ticketCategory.id,
    topic: `ticket:${user.id}`,
    permissionOverwrites: [
      {
        id: guild.roles.everyone.id,
        deny: [PermissionFlagsBits.ViewChannel]
      },
      {
        id: user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      },
      {
        id: supportRole.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory
        ]
      }
    ]
  });

  const embed = new EmbedBuilder()
    .setColor(0x5865F2)
    .setTitle(`${categoryInfo.emoji} ${categoryInfo.label}`)
    .setDescription(
      `Merhaba ${user}!\n\n` +
      `Destek talebin oluşturuldu.\n` +
      `**Kategori:** ${categoryInfo.label}\n\n` +
      `Yetkili ekibimiz en kısa sürede seninle ilgilenecektir.`
    );

  const closeButton = new ButtonBuilder()
    .setCustomId("close_ticket")
    .setLabel("Ticket Kapat")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder().addComponents(closeButton);

  await ticketChannel.send({
    content: `${user} ${supportRole}`,
    embeds: [embed],
    components: [row]
  });

  await interaction.reply({
    content: `✅ Ticketın oluşturuldu: ${ticketChannel}`,
    ephemeral: true
  });
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isButton()) return;
  if (interaction.customId !== "close_ticket") return;

  const channel = interaction.channel;

  await interaction.reply("🔒 Ticket 5 saniye içinde kapatılıyor...");

  setTimeout(async () => {
    await channel.delete().catch(() => {});
  }, 5000);
});

client.login(process.env.DISCORD_TOKEN);
