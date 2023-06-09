const client_id = "fzqu79gr25rwb3mo7yy7yh42q9nwmf";
let access_token = "";

const button_connect_twitch = document.getElementById("connect-twitch");
const button_clip = document.getElementById("clip");
const textarea_twitch_channels = document.getElementById("twitch-channels");
const span_connected = document.getElementById("connected");
const input_discord_webhook = document.getElementById("discord-webhook");
const div_clip_results = document.getElementById("clip-results");


async function get_value(name) {
    return localStorage.getItem(name);
}

async function set_value(name, value) {
    localStorage.setItem(name, value);
}

function generate_state() {
    return crypto.getRandomValues(new Uint8Array(32)).map(x => x % 10).join("");
}

async function connect_with_twitch() {
    const url = "https://tevirasa.github.io/Multi-Clipper/";
    const state = generate_state();
    const href = `https://id.twitch.tv/oauth2/authorize?response_type=token&client_id=${client_id}&redirect_uri=${url}&scope=clips%3Aedit&state=${state}`;
    await set_value("state", state);
    window.location.href = href;
}

async function validate_twitch(access_token) {
    const url = "https://id.twitch.tv/oauth2/validate";
    const response = await fetch(url, {
        headers: { "Authorization": "OAuth " + access_token },
    });
    return response.status == 200;
}

function update_valid(valid) {
    span_connected.style.color = valid ? "green" : "red";
    span_connected.textContent = valid ? "Connected" : "Disconnected";
}

async function check_params_access_token() {
    const url_fragment = new URLSearchParams(window.location.hash);
    const params = Object.fromEntries(url_fragment.entries());
    let result = "";
    if ("#access_token" in params) {
        if ("state" in params && params["state"] == await get_value("state")) {
            result = params["#access_token"];
        }
    }
    return result;
}

async function get_users(names) {
    const url = `https://api.twitch.tv/helix/users?${names.map(name => "login=" + name).join("&")}`;
    const response = await fetch(url, {
        method: "GET",
        headers: { 
            "Authorization": "Bearer " + access_token, 
            "Client-Id": client_id 
        },
    });
    const json = await response.json();
    return json.data.map(x => { return {"id": x.id, "name": x.login}; });
}

async function make_clip(user) {
    const url = `https://api.twitch.tv/helix/clips?broadcaster_id=${user.id}&has_delay=true`;
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: { 
                "Authorization": "Bearer " + access_token, 
                "Client-Id": client_id 
            },
        });
        const json = await response.json();
        return { "name": user.name, "clip": "https://clips.twitch.tv/" + json.data[0].id };
    } catch {
        return { "name": user.name, "clip": "" };
    }
}

async function make_clips(names) {
    if (names.length <= 0) return;
    const users = await get_users(names);
    await new Promise(r => setTimeout(r, 1000))
    let results = await Promise.all(users.map(make_clip));
    return results;
}

async function send_webhook(clips) {
    const url = input_discord_webhook.value.trim();
    let data = {
        "embeds": [{
            "title": "Multi Clip",
            "url": "https://tevirasa.github.io/Multi-Clipper/",
            "color": 3427761,
            "fields": clips.map(clip => { return { "name": clip.name, "value": clip.clip }; })
        }]
    };
    const response = await fetch(url, {
        "method": "POST",
        "headers": { 
            "Content-Type": "application/json",
        },
        "body": JSON.stringify(data)
    });
    return response.status;
}

function get_channel_names() {
    return textarea_twitch_channels.value.split("\n").map(x => x.trim());
}

function populate_clips(clips) {
    div_clip_results.innerHTML = clips.map(clip => `${clip.name}: <a href="${clip.clip}">${clip.clip}</a>`).join("<br>")
}

async function on_load()
{
    let valid = false;

    if (!valid && (access_token = await get_value("access_token"))) {
        valid = await validate_twitch(access_token);
    }

    if (!valid && (access_token = await check_params_access_token())) {
        valid = await validate_twitch(access_token);
    }
    
    update_valid(valid);
    set_value("access_token", valid ? access_token : "");

    input_discord_webhook.value = await get_value("webhook");
    textarea_twitch_channels.value = await get_value("channels");
}

button_connect_twitch.addEventListener("click", (event) => {
    connect_with_twitch();
});

button_clip.addEventListener("click", async (event) => {
    const names = get_channel_names();
    const clips = await make_clips(names);
    populate_clips(clips);
    send_webhook(clips);
});

textarea_twitch_channels.addEventListener("change", (event) => {
    set_value("channels", event.target.value);
})

input_discord_webhook.addEventListener("change", (event) => {
    set_value("webhook", event.target.value);
});

on_load();