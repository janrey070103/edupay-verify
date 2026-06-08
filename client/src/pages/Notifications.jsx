import { useEffect,
useState } from "react";

import axios from "axios";

const Notifications = () => {

const [notifications,
setNotifications]
= useState([]);

useEffect(() => {

axios.get(
"http://localhost:5000/api/notifications/21-1981-471"
)

.then((res) => {

setNotifications(
res.data
);

});

}, []);

return (

<div>

<h1>
Notifications
</h1>

{
notifications.map(
(item) => (

<div
key={item._id}
>

<h3>
{item.title}
</h3>

<p>
{item.message}
</p>

</div>

))
}

</div>

);

};

export default Notifications;