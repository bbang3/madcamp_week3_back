const Team = require("../models/Team");
const Match = require("../models/Match");
const MatchRequest = require("../models/MatchRequest");
const Chat = require("../models/Chat");

const TEAM_SIZE = 5;

const teamMaking = async (req, res) => {
  const request = res.locals.request;
  console.log("matchMaking", request);

  const matchedTeam = await Team.findOne({
    requestIds: { $ne: request._id },
    category: request.category,
    teamSize: TEAM_SIZE - request.groupSize,
  });
  console.log("matchMaking2", matchedTeam);

  if (!matchedTeam) {
    // if no request matched, create new team
    const newTeam = new Team({
      requestIds: [request._id],
      category: request.category,
      teamSize: request.groupSize,
      skills: request.skills,
      intensity: request.intensity,
      age: request.age,
      date: request.date,
      location: request.location,
    });
    return await newTeam.save();
  } else {
    const requestCount = matchedTeam.requestIds.length;
    matchedTeam.location.lat =
      (matchedTeam.location.lat * requestCount + request.location.lat) /
      (requestCount + 1);

    matchedTeam.location.lng =
      (matchedTeam.location.lng * requestCount + request.location.lng) /
      (requestCount + 1);

    let currentTime = matchedTeam.date.getTime();
    let newTime =
      (currentTime * requestCount + request.date.getTime()) /
      (requestCount + 1);

    matchedTeam.date = new Date(newTime);

    matchedTeam.teamSize += request.groupSize;
    matchedTeam.requestIds.push(request._id);
    return await matchedTeam.save();
  }
};

const matchMaking = async (req, res) => {
  const myTeam = await teamMaking(req, res);
  console.log("myTeam", myTeam);
  if (myTeam.teamSize !== 5) return;

  const oppTeam = await Team.findOne({
    category: myTeam.category,
    _id: { $ne: myTeam._id },
    teamSize: { $eq: 5 },
  });
  if (!oppTeam) return;
  console.log(oppTeam);

  const team1 = [];
  for (requestId of myTeam.requestIds) {
    team1.push({
      requestId: requestId,
      status: 0,
    });
  }

  const team2 = [];
  for (requestId of oppTeam.requestIds) {
    team2.push({
      requestId: requestId,
      status: 0,
    });
  }

  const newMatch = new Match({
    category: myTeam.category,
    team1: team1,
    team2: team2,
    date: new Date((myTeam.date.getTime() + oppTeam.date.getTime()) / 2),
    location: {
      lat: (myTeam.location.lat + oppTeam.location.lat) / 2,
      lng: (myTeam.location.lng + oppTeam.location.lng) / 2,
    },
  });
  const output = await newMatch.save();
  for (teamInfo of output.team1) {
    console.log("team1", teamInfo.requestId);
    const mr = MatchRequest;
    await MatchRequest.findByIdAndUpdate(teamInfo.requestId, {
      matchId: output._id,
      status: 1,
    });
  }
  for (teamInfo of output.team2) {
    console.log("team2", teamInfo.requestId);
    await MatchRequest.findByIdAndUpdate(teamInfo.requestId, {
      matchId: output._id,
      status: 1,
    });
  }
  await Team.findByIdAndRemove(myTeam._id);
  await Team.findByIdAndRemove(oppTeam._id);
  const newChat = new Chat({
    roomId: output._id,
    content: [],
  });
  newChat.save();
};

module.exports = matchMaking;
