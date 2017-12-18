let io = require('socket.io').listen(50000);

// let clientList = [];
let roomList = [];

io.sockets.on('connection', function(socket) {
	socket.on('join', function(data) {
		let client = new Client(socket, data);
		let room = roomList.find(function(item) {
			return item.roomNum == client.roomNum;
		});
		if(room == undefined) {
			socket.emit('joinFail', 'fail');
			return;
		}
		let clientList = room.clientList;
		let res = { log: room.log };

		let sameClient = clientList.find(function(item) {
			return item.sessionId == client.sessionId;
		});
		if(sameClient != undefined) {
			console.log('rejoined');
			// sameClient.disconnected = false;
			sameClient.disconnected[0].status = false;
			sameClient.disconnected.splice(0, 1);
			sameClient.socketId = socket.id;
			res.paintNum = sameClient.paintNum;
			res.paint = sameClient.paint;
		} else {
			client.paintNum = room.paintCounter();
			clientList.push(client);
			res.paintNum = client.paintNum;
		}

		let paintList = [];
		clientList.forEach(function(item, index) {
			let paint = {
				paintNum: item.paintNum,
				paint: item.paint,
				userId: item.userId
			}
			paintList.push(paint);
		});

		res.paintList = paintList;

		
		socket.emit('join', res);		// 채팅 로그 전송
	});

	socket.on('leave', function(data) {
		roomList.find(function(room, roomIndex) {
			let clientIndex = room.clientList.findIndex(function(client) {
				return client.sessionId == data.sessionId;
			});

			if(clientIndex >= 0) {
				room.clientList.splice(clientIndex, 1);
				room.checkDel();
				return true;
			} else {
				return false;
			}
		});
	});

	socket.on('disconnect', function(data) {
		roomList.find(function(room, roomIndex) {
			let client = room.clientList.find(function(client) {
				return client.socketId == socket.id;
			});
			
			if(client!=undefined) {
				let disconnected = { status: true };
				client.disconnected.push(disconnected);
				setTimeout(function() {
					if(disconnected.status) {
						let clientIndex = room.clientList.indexOf(client);
						room.clientList.splice(clientIndex, 1);
						room.checkDel();
					}
				}, 100);
				return true;
			} else {
				return false;
			}
		});
	});

	socket.on('send', function(data) {
		let logged = false;
		let room = roomList.find(function(item) {
			return item.roomNum == data.roomNum;
		});
		if(room == undefined) { return; }

		if(!logged) {	// 메세지 로깅
			switch(data.type) {
			case 'msg':
				room.log.push({userId: data.userId, msg: data.msg});
				break;
			case 'paint':
				let client = room.clientList.find(function(client) {
					return client.paintNum == data.paintNum;
				});
				if(client != undefined) {
					client.paint = data.paint;
				}
				break;
			}
			logged = true;
		}
		data.sessionId = undefined;
		room.clientList.forEach(function(client, index) {
			io.to(client.socketId).emit('sendAll', data);
		});
	});

	socket.on('getRoomList', function(data) {
		let res = roomList.filter(function(room) {
			return room.groupNum == data.groupNum;
		});
		console.log('getRoomList', data);
		socket.emit('getRoomList', { roomList: res });
	});

	socket.on('newRoom', function(data) {
		let room = new Room(data);
		roomList.push(room);
		socket.emit('newRoom', {roomNum: room.roomNum});
	});

	socket.on('switchPaint', function(data) {
		let room = roomList.find(function(room) {
			return room.roomNum == data.roomNum;
		});
		if(room != undefined) {
			let client = room.clientList.find(function(client) {
				return client.paintNum == data.paintNum;
			});
			if(client != undefined) {
				socket.emit('switchPaint', {
					paintNum: data.paintNum,
					paint: client.paint
				});
			}
		}
	});
});


function counter() {
	let i = 0;
	return function() {
		i += 1;
		return i;
	}
}

function Client(socket, data) {
	this.socketId = socket.id;
	this.userId = data.userId;
	this.sessionId = data.sessionId;
	this.disconnected = [];
	this.paint = data.paint;
	/*
	for(let i in roomList) {
		if(roomList[i].roomNum == data.roomNum) {
			this.room = roomList[i];
		}
	}
	*/
	this.roomNum = data.roomNum;
}

function Room(data) {
	this.roomName = data.roomName;
	this.groupNum = data.groupNum;
	this.clientList = [];
	this.roomNum = this.counter();
	this.log = [];
	this.paintCounter = counter();
}
Room.prototype.counter = counter();
Room.prototype.checkDel = function() {
	let res = false;
	if(this.clientList.length == 0) {
		let roomIndex = roomList.indexOf(this);
		if(roomIndex >= 0) {
			roomList.splice(roomIndex, 1);
			res = true;
		}
	}
	return res;
}
