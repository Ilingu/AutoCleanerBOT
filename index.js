const { Client, MessageEmbed, Intents } = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");
const { config } = require("dotenv");
const schedule = require("node-schedule");
const admin = require("firebase-admin");

// Initialize Firebase
const serviceAccount = require("./google-credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Config
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.DIRECT_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MEMBERS,
  ],
});
config({
  path: __dirname + "/.env",
});

// Fn
const POSTMessage = (AllMessage, channel, MessageID, guild, TimeImgDelete) => {
  // 172800000 -> Ms of 2days
  // 432000000 => Ms of 5days
  db.collection("guilds")
    .doc(guild)
    .update({
      messageImageToSuppr:
        AllMessage === false
          ? [
              {
                channel,
                MessageID,
                TimeStamp: Date.now() + TimeImgDelete,
              },
            ]
          : [
              ...AllMessage,
              {
                channel,
                MessageID,
                TimeStamp: Date.now() + TimeImgDelete,
              },
            ],
    });
};

const UpdateMessageVar = (Data, guild) => {
  db.collection("guilds").doc(guild).update({
    messageImageToSuppr: Data,
  });
};

const deleteAllChannelImage = (guildId, channelId) => {
  db.collection("guilds")
    .doc(guildId)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const Data = doc.data().messageImageToSuppr;
        if (Data) {
          const ArrayMsgResult = Data.filter(
            (Msg) => Msg.channel !== channelId
          );
          UpdateMessageVar(ArrayMsgResult, guildId);
        }
      } else {
        console.log("No such document!");
      }
    })
    .catch(console.error);
};

const UserDeleteImg = (guild, channel, MessageID) => {
  db.collection("guilds")
    .doc(guild)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const Data = doc.data().messageImageToSuppr;
        if (Data) {
          Data.forEach((Msg, i) => {
            if (Msg.MessageID === MessageID && Msg.channel === channel) {
              Data.splice(i, 1);
            }
          });
          UpdateMessageVar(Data, guild);
        }
      } else {
        console.log("No such document!");
      }
    })
    .catch(console.error);
};

const CheckMsgImg = (guild) => {
  db.collection("guilds")
    .doc(guild)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const Data = doc.data().messageImageToSuppr;
        if (Data) {
          Data.forEach((Msg, i) => {
            if (Msg.TimeStamp <= Date.now()) {
              const channelOfMessage = client.channels.cache.find(
                (ch) => ch.id === Msg.channel
              );
              if (channelOfMessage) {
                channelOfMessage.messages
                  .fetch(Msg.MessageID)
                  .then((msgSupp) => {
                    msgSupp.delete();
                  })
                  .catch(console.error);
                Data.splice(i, 1);
              }
            }
          });
          UpdateMessageVar(Data, guild);
        }
      } else {
        console.log("No such document!");
      }
    })
    .catch(console.error);
};

const CreateNewImg = (guild, channel, MessageID) => {
  db.collection("guilds")
    .doc(guild)
    .get()
    .then((doc) => {
      if (doc.exists) {
        const Data = doc.data();
        if (Data.messageImageToSuppr)
          POSTMessage(
            Data.messageImageToSuppr,
            channel,
            MessageID,
            guild,
            Data.TimeImgDelete || 432000000
          );
        else
          POSTMessage(
            false,
            channel,
            MessageID,
            guild,
            Data.TimeImgDelete || 432000000
          );
      } else {
        console.log("No such document!");
      }
    })
    .catch(console.error);
};

// Cron
const rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 10;
rule.tz = "Europe/Paris";

schedule.scheduleJob(rule, () => {
  client.guilds.cache.forEach((guild) => {
    CheckMsgImg(guild.id);
  });
  console.log(`Auto Test du ${Date.now()}`);
});

/* /slash command */

const NewSlash = (name, desc) =>
  new SlashCommandBuilder().setName(name).setDescription(desc);
const SlashCmd = [
  NewSlash("help", "List of all bot commands").addSubcommand((subcommand) => {
    const sub = subcommand
      .setName("about")
      .setDescription("Info About Author of this Bot");
    sub.type = 1;
    return sub;
  }),
  NewSlash("invite", "Invite this bot to your server"),
  NewSlash("ping", "Returns your ping (in ms)"),
];

// BOT
client.on("ready", async () => {
  console.log(`I'm now online, my name is ${client.user.username}`);
  client.user.setActivity(`ac!help - clean ur server`, {
    type: "WATCHING",
  });

  client.application.commands.cache.forEach((cmd) => cmd.delete());
  for (const command of SlashCmd) {
    client.application.commands.create(command);
  }
});

// /slash command listener
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === "help") {
    if (interaction.options.getSubcommand() === "about") {
      const EmbedAuthor = new MessageEmbed()
        .setColor(0xffc300)
        .setTitle("**Me, Ilingu 😎**")
        .setDescription(
          `Nice to meet you _@${interaction.user.username}_, I'm Ilingu, the creator of AutoCleanerBOT.\n\n🌐 **Connect With Me:**\n__Github:__ https://github.com/Ilingu\n__Email:__ ilingu@protonmail.com`
        )
        .setURL("https://github.com/Ilingu")
        .setFooter({
          text: client.user.username,
          iconURL: client.user.displayAvatarURL(),
        });

      await interaction.reply({
        embeds: [EmbedAuthor],
        ephemeral: true,
      });
      return setTimeout(() => {
        interaction.followUp({
          content: "Also I forgot to mention that I'm an **EPIC DEV** ⚡",
          ephemeral: true,
        });
      }, 1400);
    }
    const prefix = "ac!";
    const EmbedHelp = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle("**How to use AutoCleaner ? | ac!help**")
      .setDescription(
        `- __prefix:__ ${prefix}\n- **${prefix}help**\n=> See all my commands\n- **${prefix}invite**\n=>- Url for adding this bot into your server\n- **${prefix}ping**\n=>- Returns your ping (in ms)`
      )
      .setTimestamp()
      .setAuthor({
        name: interaction.user.username,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setFooter({
        text: client.user.username,
        iconURL: client.user.displayAvatarURL(),
      });
    return interaction.reply({ embeds: [EmbedHelp] });
  }
  if (interaction.commandName === "invite") {
    return interaction.reply({
      content: `Hello ${interaction.user.username} 🖐\nHere you invite url: https://discord.com/api/oauth2/authorize?client_id=831828766245912596&permissions=8&scope=bot%20applications.commands \n`,
      ephemeral: true,
    });
  }
  if (interaction.commandName === "ping") {
    const EmbedPing = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle(`🏓 ${interaction.user.username}'s ping`)
      .addField(
        "⏳__You:__",
        `**${Date.now() - interaction.createdTimestamp}**ms`
      )
      .addField("⏱__BOT__", `*${Math.round(client.ws.ping)}*ms`);
    return interaction.reply({ embeds: [EmbedPing] });
  }
  return interaction.reply("❌ Command Not Found");
});

client.on("guildCreate", async (gData) => {
  // Msg Of Hello
  const channel = client.channels.cache.find((ch) => ch.type === "GUILD_TEXT");
  const msg = await channel.send({
    embeds: [
      new MessageEmbed()
        .setColor(0xffc300)
        .setTitle(`**Thank you for inviting me into ${gData.name}!**✅`)
        .setDescription("-Try `ac!help` to see all my commands\n-Prefix: `ac!`")
        .setTimestamp()
        .setFooter({
          text: client.user.username,
          iconURL: client.user.displayAvatarURL(),
        }),
    ],
  });
  // Connect Guild To DB
  db.collection("guilds")
    .doc(gData.id)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        db.collection("guilds").doc(gData.id).set({
          guildID: gData.id,
          guildName: gData.name,
          messageImageToSuppr: [],
        });
      } else {
        msg.edit(
          new MessageEmbed()
            .setColor(0xffc300)
            .setTitle(
              `**Ho Ho Happy to see you again, I missed you, ${gData.name}**✅`
            )
            .setDescription(
              "-Try `ac!help` to see all my commands\n-Prefix: `ac!`"
            )
            .setTimestamp()
            .setFooter({
              text: client.user.username,
              iconURL: client.user.displayAvatarURL(),
            })
        );
      }
    })
    .catch(console.error);
  // Slash Command
  for (const command of SlashCmd) {
    client.application.commands.create(command, gData.id);
  }
});

client.on("guildDelete", async (gData) => {
  db.collection("guilds").doc(gData.id).update({
    ConnLost: Date.now(),
  });
  for (const command of SlashCmd) {
    client.application.commands.delete(command, gData.id);
  }
  console.log(
    `Connection Lost with ${gData.name} guild (GuildID: ${gData.id})`
  );
});

client.on("messageCreate", (message) => {
  const prefix = "ac!";
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (!message.guild) {
    // DM
    if (message.author.bot) return;
    if (cmd === "invite")
      return message.reply({
        content: `Hello ${message.author.username} 🖐\nHere you invite url: https://discord.com/api/oauth2/authorize?client_id=831828766245912596&permissions=8&scope=bot%20applications.commands \n`,
      });
    return;
  }

  /* Features */
  const guild = message.guild.id,
    channel = message.channel.id,
    MessageID = message.id;

  // Img
  if (message.attachments.size > 0) CreateNewImg(guild, channel, MessageID);
  else CheckMsgImg(guild);

  // Good Channel For Music
  if (
    message.author.id === "185476724627210241" &&
    message.channel.name !== "music-cmd" &&
    message.deletable
  )
    message.delete();

  if (
    message.content.startsWith("=music") &&
    message.channel.name !== "music-cmd"
  ) {
    if (message.deletable) message.delete();
    const channelMusic = message.guild.channels.cache.find(
      (ch) => ch.name === "music-cmd"
    );
    message
      .reply({
        content: `❌ Mauvais Salon ❌\nLe salon pour les commandes du BOT music est <#${channelMusic.id}>`,
      })
      .then((m) => {
        setTimeout(() => m.delete(), 15000);
      });
  }

  // Cmd
  if (!message.content.startsWith(prefix)) return;
  if (cmd === "time") {
    if (message.deletable) setTimeout(() => message.delete(), 5000);

    return message
      .reply({ content: "Fonctionnalité désactivé pour le moment" })
      .then((m) => setTimeout(() => m.delete(), 5000));
  } else if (cmd === "invite") {
    if (message.deletable) setTimeout(() => message.delete(), 10000);
    if (!message.author.bot)
      message.author.send({
        content: `Hello ${message.author.username} 🖐\nHere you invite url: https://discord.com/api/oauth2/authorize?client_id=831828766245912596&permissions=8&scope=bot%20applications.commands \n`,
      });
  } else if (cmd === "help") {
    if (message.deletable) setTimeout(() => message.delete(), 10000);
    const Embed = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle("**How to use AutoCleaner ? | ac!help**")
      .setDescription(
        `- __prefix:__ ${prefix}\n- **${prefix}help**\n=> See all my commands\n- **${prefix}invite**\n=>- Url for adding this bot into your server\n- **${prefix}ping**\n=>- Returns your ping (in ms)`
      )
      .setTimestamp()
      .setAuthor({
        name: message.author.username,
        iconURL: message.author.displayAvatarURL(),
      })
      .setFooter({
        text: client.user.username,
        iconURL: client.user.displayAvatarURL(),
      });

    return message.reply({ embeds: [Embed] });
  } else if (cmd === "ping") {
    if (message.deletable) setTimeout(() => message.delete(), 5000);
    const Embed = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle(`🏓 ${message.author.username}'s ping`)
      .addField("⏳__You:__", `**${Date.now() - message.createdTimestamp}**ms`)
      .addField("⏱__BOT__", `*${Math.round(client.ws.ping)}*ms`);
    message.channel.send({ embeds: [Embed] });
  } else {
    return message
      .reply({ content: `❌ this command does not exist, try **ac!help**` })
      .then((m) => setTimeout(() => m.delete(), 5000));
  }
});

client.on("messageDelete", (message) => {
  const guild = message.guild.id,
    channel = message.channel.id,
    MessageID = message.id;

  if (message.attachments.size > 0) {
    UserDeleteImg(guild, channel, MessageID);
  } else {
    CheckMsgImg(guild);
  }
});

client.on("channelDelete", (channel) =>
  deleteAllChannelImage(channel.guild.id, channel.id)
);

client.login(process.env.TOKEN);
