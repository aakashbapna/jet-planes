var doodle = (function() {
    Function.prototype.bind = Function.prototype.bind || function(fixThis) {
        var func = this
        return function() {
            return func.apply(fixThis, arguments)
        }
    }
    var DEBUG = false;
    var _l = function(obj) {
        DEBUG && console && console.log && console.log(obj)
    }
    var html = document.documentElement;
    var requestAnimationFrame = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        function(func) {
            setTimeout(func, 17);
        };
    var
        PI_half = Math.PI / 2, resources = {};


    var Stage = function(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.objects = [];
        this.restart_timeout = 1000;
        this.paused = false;
        this.destroyed = false;
        return this;
    };

    var fps = 0, now, lastUpdate = (new Date) * 1 - 1;

    // The higher this value, the less the FPS will be affected by quick changes
    // Setting this to 1 will show you the FPS of the last sampled frame only
    var fpsFilter = 50;
    var set_fps = function() {
        var thisFrameFPS = 1000 / ((now = new Date) - lastUpdate);
        fps += (thisFrameFPS - fps) / fpsFilter;
        lastUpdate = now;
    }
    //setInterval(function(){
    // _l(fps.toFixed(1) + "fps");
    //}, 1000);


    Stage.prototype.frame = function() {
        if (this.destroyed) {
            return;
        }

        //set_fps();

        //clear the stage(canvas);
        this.ctx.clearRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)

        //call tick on all the objects on stage
        for (var i in this.objects) {
            if (this.objects[i].destroyed == true) {
                this.objects.splice(i, 1)
            } else {
                this.objects[i].tick(this.ctx)
            }
        }

        if (this.objects.length == 0) {
            var self = this
            setTimeout(function() {
                _l("restarting in " + self.restart_timeout)
                self.setup();
                self.frame();
            }, this.restart_timeout);
        } else if (!this.paused) {
            //recursivily call itself
            requestAnimationFrame(this.frame.bind(this))
        }

    };

    Stage.prototype.setup = function() {

        this.objects.push(getRandomFormation(this));

    };

    Stage.prototype.destroy = function() {
        this.destroyed = true;
        this.objects = [];
    }

    var Formation = function(x, y) {
        this.x = x;
        this.y = y;
        this.planes = [];
    };

    Formation.prototype.addPlane = function(formation_x, formation_y, color) {
        var plane_x = this.x + formation_x, plane_y = this.y + formation_y;
        var plane = new JetPlane(resources.jet_img, plane_x, plane_y, color, formation_x, formation_y);
        this.planes.push(plane);
        return plane;
    };

    Formation.prototype.travelTo = function(x, y, v) {
        var f_plane;
        for (var i in this.planes) {
            f_plane = this.planes[i];
            f_plane.travelTo(f_plane.formation_x + x, f_plane.formation_y + y, v)
        }
    };

    Formation.prototype.tick = function(ctx) {

        for (var i in this.planes) {
            if (this.planes[i].destroyed) {
                _l("deleting plane " + i)
                this.planes.splice(i, 1);
            } else {
                this.planes[i].tick(ctx);
            }
        }

        if (this.planes.length == 0) {
            this.destroy();
        }
    };

    Formation.prototype.destroy = function() {
        this.destroyed = true;
    };

    var getRandomFormation = function(stage) {
        var y_to_zero = Math.random() > 0.5 ? true : false
        var init_y = y_to_zero ? stage.ctx.canvas.height : 10 + (stage.ctx.canvas.height - 10) * Math.random();
        var init_x = y_to_zero ? (stage.ctx.canvas.width / 2 - 10) * Math.random() : 10;

        _l("starting from:" + init_x + " ," + init_y);
        var formation = new Formation(init_x, init_y);

        formation.addPlane(0, 0, "255, 153, 51");
        formation.addPlane(50, -50, "222, 222, 222");
        formation.addPlane(100, 0, "0, 128, 0");

        var target_y = stage.ctx.canvas.height - init_y;
        var target_x = stage.ctx.canvas.width - init_x;

        formation.travelTo(target_x, target_y, 3 + 3 * Math.random());
        return formation;
    };

    var JetPlane = function(img, initX, initY, smoke_rgb, formation_x, formation_y) {
        this.img = img
        this.x = initX;
        this.y = initY;
        this.formation_x = formation_x;
        this.formation_y = formation_y
        this.smoke_particles_list = [];
        this.smoke_rgb = smoke_rgb;
        this.destroy_plane = false;
        this.pather = new PathMaker();
        return this;
    };

    JetPlane.prototype.draw = function (ctx) {
        ctx.save();
        var angle = Math.atan(this.pather.slope) + PI_half;
        //console.log(angle)
        ctx.translate(this.x, this.y);
        //ctx.translate(23, 32)
        ctx.rotate(angle)

        ctx.drawImage(this.img, 0, 0);
        //ctx.drawImage(this.img, this.x, this.y);
        ctx.restore();

        for (var i in this.smoke_particles_list) {
            if (this.smoke_particles_list[i].destroyed == true) {
                this.smoke_particles_list.splice(i, 1);
            } else {
                this.smoke_particles_list[i].draw(ctx);
            }
        }

    }

    JetPlane.prototype.travelTo = function(_x, _y, v) {
        this.pather.createPath(this.x, this.y, _x, _y, v);
    }

    JetPlane.prototype.tick = function(ctx) {
        //this.x = this.x + 5;
        this.pather.move();
        var angle = Math.atan(this.pather.slope) + PI_half;
        var adj_x = - this.formation_x + this.formation_x * Math.cos(angle) - this.formation_y * Math.sin(angle);
        var adj_y = - this.formation_y + this.formation_x * Math.sin(angle) + this.formation_y * Math.cos(angle);
        this.x = this.pather.x + adj_x;
        this.y = this.pather.y + adj_y;
        if (this.smoke_particles_list.length < 100 && !this.destroy_plane) {
            var delta_x = (11 + 2 * Math.random()) * Math.cos(angle) - (29 + 4 * Math.random()) * Math.sin(angle);
            var delta_y = (11 + 2 * Math.random()) * Math.sin(angle) + (29 + 4 * Math.random()) * Math.cos(angle);
            var smoke_particle = new SmokeParticle(this.x + delta_x, this.y + delta_y, this.smoke_rgb)
            this.smoke_particles_list.push(smoke_particle);
        }
        this.draw(ctx);

        var bbw = 50; //bounding box width
        if (this.x > ctx.canvas.width + bbw || this.y > ctx.canvas.height + bbw || this.x < 0 - bbw || this.y < 0 - bbw) {
            this.destroy_plane = true;
        } else {
            this.destroy_plane = false;
        }

        if (this.destroy_plane && this.smoke_particles_list.length == 0) {
            this.destroy()
        }

    };

    JetPlane.prototype.destroy = function() {
        this.destroyed = true;
    }


    var PathMaker = function() {
        this.speed = 2.5;
        this.slope = null
        this.x = 0;
        this.y = 0;
        this.delta_x = 0;
        this.delta_y = 0;
    };

    PathMaker.prototype.createPath = function(x1, y1, x2, y2, v) {
        this.x = x1;
        this.y = y1;
        this.delta_x = x2 - x1;
        this.delta_y = y2 - y1;
        this.slope = this.delta_y / this.delta_x;
        this.speed = v;
    }

    PathMaker.prototype.setSpeed = function (v) {
        this.speed = v;
    }

    PathMaker.prototype.move = function () {
        this.x = this.x + Math.cos(Math.atan(this.slope)) * this.speed;
        this.y = this.y + Math.sin(Math.atan(this.slope)) * this.speed;
    }


    var SmokeParticle = function (paramX, paramY, rgb) {
        this.x = paramX;
        this.y = paramY;
        this.opacity = 0.5
        this.radius = 2 + Math.random();
        this.rgb = rgb;
    };

    SmokeParticle.prototype.draw = function(ctx) {
        ctx.save();

        ctx.beginPath();
        ctx.fillStyle = 'rgba(' + this.rgb + ',' + this.opacity + ')';
        ctx.shadowColor = 'rgba(' + this.rgb + ',1)';

        //ctx.shadowBlur = 5;

        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, true);
        ctx.fill();

        this.radius = this.radius + 0.05;
        this.opacity = this.opacity - 0.005;
        if (this.opacity <= 0) {
            this.destroyed = true;
        }
        ;

        ctx.restore();
    };

    var stage;
    var init = function(jet_img_src) {

        var canvas = document.createElement('canvas');
        canvas.id = "canvas_doodle";
        canvas.height = window.innerHeight || html.clientHeight;
        canvas.width = window.innerWidth || html.clientWidth;
        var canvasStyle = canvas.style;
        canvasStyle.position = 'fixed';
        canvasStyle.top = 0;
        canvasStyle.left = 0;
        canvasStyle.zIndex = 1138;
        canvasStyle['pointerEvents'] = 'none';
        document.body.appendChild(canvas);
        stage = new Stage(canvas);
        resources.jet_img = new Image();
        resources.jet_img.src = jet_img_src;
        resources.jet_img.onload = function() {
            stage.setup();
            requestAnimationFrame(stage.frame.bind(stage))
        }

    };

    var destroy = function() {
        stage.destroy();
        setTimeout(function() {
            document.body.removeChild(document.getElementById("canvas_doodle"));
        }, 50);
        delete stage;
    }

    return {
        "init":init,
        "destroy":destroy
    }

})();