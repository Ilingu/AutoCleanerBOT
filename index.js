const { Client, MessageEmbed, APIMessage } = require("discord.js");
const { config } = require("dotenv");
const schedule = require("node-schedule");
const firebase = require("firebase/app");
const admin = require("firebase-admin");

// Initialize Firebase
const serviceAccount = require("./google-credentials.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Config
const client = new Client({
  disableMentions: "everyone",
});
config({
  path: __dirname + "/.env",
});
// Fn
const POSTMessage = (AllMessage, channel, MessageID, guild, TimeImgDelete) => {
  // 172800000 => Ms of 2days
  // 432000000 => Ms of 5days
  // 1728000000 => Ms of 20d
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

const deleteAllChannelRemovableObj = (guildId, channelId) => {
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

const UserDeleteRemovableObj = (guild, channel, MessageID) => {
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

const CheckMsgToDelete = (guild) => {
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

const CreateNewRemovableObj = (guild, channel, MessageID, dmMsg = false) => {
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
            dmMsg ? 1728000000 : 432000000
          );
        else
          POSTMessage(
            false,
            channel,
            MessageID,
            guild,
            dmMsg ? 1728000000 : 432000000
          );
      } else {
        console.log("No such document!");
      }
    })
    .catch(console.error);
};

const getApp = (guildID) => {
  const app = client.api.applications(client.user.id);
  if (guildID) {
    app.guilds(guildID);
  }
  return app;
};

const createAPIMessage = async (interaction, content) => {
  const { data, files } = await APIMessage.create(
    client.channels.resolve(interaction.channel_id),
    content
  )
    .resolveData()
    .resolveFiles();

  return { ...data, files };
};

const replyToCommand = async (interaction, replyText) => {
  let data = {
    content: replyText,
  };

  // Check For Embed
  if (typeof replyText === "object") {
    data = await createAPIMessage(interaction, replyText);
  }

  client.api.interactions(interaction.id, interaction.token).callback.post({
    data: {
      type: 4,
      data,
    },
  });
};

const AddSlashCommandForGuildID = async (guildCommandsID) => {
  await getApp(guildCommandsID).commands.post({
    data: {
      name: "ping",
      description: "Returns your ping (in ms)",
    },
  });
  await getApp(guildCommandsID).commands.post({
    data: {
      name: "invite",
      description: "Get invite link of this bot",
    },
  });
  await getApp(guildCommandsID).commands.post({
    data: {
      name: "help",
      description: "All bot commands",
    },
  });
};
// Cron
const rule = new schedule.RecurrenceRule();
rule.hour = 0;
rule.minute = 10;
rule.tz = "Europe/Paris";

schedule.scheduleJob(rule, () => {
  client.guilds.cache.forEach((guild) => {
    CheckMsgToDelete(guild.id);
  });
  console.log(`Auto Test du ${Date.now()}`);
});
// BOT
client.on("ready", async () => {
  console.log(`I'm now online, my name is ${client.user.username}`);
  client.user.setActivity(`ac!help - clean ur server`, {
    type: "WATCHING",
  });

  /* "/" commands */
  // Create
  client.guilds.cache.forEach(async (guildCommandsID) => {
    AddSlashCommandForGuildID(guildCommandsID.id);
  });
  // Interact
  client.ws.on("INTERACTION_CREATE", async (interaction) => {
    const { name, options } = interaction.data;
    const command = name.toLowerCase();

    const args = {};

    if (options) {
      for (const option of options) {
        const { name, value } = option;
        args[name] = value;
      }
    }

    if (command === "ping") {
      const embed = new MessageEmbed()
        .setColor(0xffc300)
        .setTitle(`🏓pong`)
        .addField("⏱__BOT__", `*${Math.round(client.ws.ping)}*ms`);
      replyToCommand(interaction, embed);
    } else if (command === "help") {
      const prefix = "ac!";
      const Embed = new MessageEmbed()
        .setColor(0xffc300)
        .setTitle("**How to use AutoCleaner ? | ac!help**")
        .setDescription(
          `- __prefix:__ ${prefix}\n- **${prefix}time <Hours/Day(s)>**\n=> Edit time before the bot deletes images\n=> __Example:__ ${prefix}time 2d / ${prefix}time 22h\n- **${prefix}help**\n=> See all my commands\n- **${prefix}invite**\n=>- Url for adding this bot into your server\n- **${prefix}ping**\n=>- Returns your ping (in ms)`
        )
        .setTimestamp()
        .setFooter(client.user.username, client.user.displayAvatarURL());
      replyToCommand(interaction, Embed);
    } else if (command === "invite") {
      replyToCommand(
        interaction,
        `Here you invite url: https://discord.com/api/oauth2/authorize?client_id=831828766245912596&permissions=8&scope=bot%20applications.commands`
      );
    } else {
      replyToCommand(
        interaction,
        "This is not a command or you provide a wrong command."
      );
    }
  });
});

client.on("channelDelete", (channel) =>
  deleteAllChannelRemovableObj(channel.guild.id, channel.id)
);

client.on("guildCreate", async (gData) => {
  // Add "/" cmd
  AddSlashCommandForGuildID(gData.id);
  // Msg Of Hello
  const channel = client.channels.cache.find((ch) => ch.type === "text");
  const msg = await channel.send(
    new MessageEmbed()
      .setColor(0xffc300)
      .setTitle(`**Thank you for inviting me into ${gData.name}!**✅`)
      .setDescription("-Try `ac!help` to see all my commands\n-Prefix: `ac!`")
      .setTimestamp()
      .setFooter(client.user.username, client.user.displayAvatarURL())
  );
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
            .setFooter(client.user.username, client.user.displayAvatarURL())
        );
      }
    })
    .catch(console.error);
});

client.on("guildDelete", async (gData) => {
  db.collection("guilds").doc(gData.id).update({
    ConnLost: Date.now(),
  });
  console.log(
    `Connection Lost with ${gData.name} guild (GuildID: ${gData.id})`
  );
});

client.on("message", (message) => {
  const prefix = "ac!";
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();
  if (!message.guild) {
    // DM
    if (message.author.bot) return;
    if (cmd === "invite")
      return message.reply(
        `Hello ${message.author.username} 🖐\n Here you invite url: https://discord.com/api/oauth2/authorize?client_id=831828766245912596&permissions=8&scope=bot%20applications.commands \n`
      );
    return;
  }
  /* Features */
  const guild = message.guild.id,
    channel = message.channel.id,
    MessageID = message.id;
  // Img
  message.attachments.size > 0 &&
    CreateNewRemovableObj(guild, channel, MessageID);
  message.channel.name === "dm" &&
    !message.attachments.size &&
    CreateNewRemovableObj(guild, channel, MessageID, true);
  !message.attachments.size &&
    message.channel.name !== "dm" &&
    CheckMsgToDelete(guild);

  // CMD
  if (!message.content.startsWith(prefix)) return;
  if (cmd === "time") {
    if (message.deletable) message.delete({ timeout: 10000 });
    return message
      .reply("Fonctionnalité désactivé pour le moment")
      .then((m) => m.delete({ timeout: 5000 }));
  } else if (cmd === "invite") {
    if (message.deletable) message.delete({ timeout: 10000 });
    if (!message.author.bot)
      message.author.send(
        `Hello ${message.author.username} 🖐\n Here you invite url: https://discord.com/api/oauth2/authorize?client_id=831828766245912596&permissions=8&scope=bot%20applications.commands \n`
      );
  } else if (cmd === "help") {
    if (message.deletable) message.delete({ timeout: 10000 });
    const Embed = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle("**How to use AutoCleaner ? | ac!help**")
      .setDescription(
        `- __prefix:__ ${prefix}\n- **${prefix}help**\n=> See all my commands\n- **${prefix}invite**\n=>- Url for adding this bot into your server\n- **${prefix}ping**\n=>- Returns your ping (in ms)`
      )
      .setTimestamp()
      .setAuthor(message.author.username, message.author.displayAvatarURL())
      .setFooter(client.user.username, client.user.displayAvatarURL());

    return message.reply(Embed);
  } else if (cmd === "ping") {
    if (message.deletable) message.delete({ timeout: 5000 });
    const Embed = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle(`🏓 ${message.author.username}'s ping`)
      .addField("⏳__You:__", `**${Date.now() - message.createdTimestamp}**ms`)
      .addField("⏱__BOT__", `*${Math.round(client.ws.ping)}*ms`);
    message.channel.send(Embed);
  } else {
    return message
      .reply(`❌ this command does not exist, try **ac!help**`)
      .then((m) => m.delete({ timeout: 5000 }));
  }
});

client.on("messageDelete", (message) => {
  const guild = message.guild.id,
    channel = message.channel.id,
    MessageID = message.id;
  message.attachments.size > 0 || message.channel.name === "dm"
    ? UserDeleteRemovableObj(guild, channel, MessageID)
    : null;

  !message.attachments.size &&
    message.channel.name !== "dm" &&
    CheckMsgToDelete(guild);
});

// Login
client.login(process.env.TOKEN);
