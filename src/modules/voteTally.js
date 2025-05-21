import { subscribe, get } from '../store.js';
import Chart from 'chart.js/auto';

let chart;
let interval;
let ctx;

export function startVoteMeter() {
    const canvas = document.getElementById('voteChart');
    if (!canvas) return;

    // Make it visible
    canvas.classList.remove('hidden');

    ctx = canvas.getContext('2d');

    chart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Yes', 'No'],
            datasets: [{
                label: 'Votes',
                data: [0, 0],
                backgroundColor: ['limegreen', 'tomato'],
            }]
        },
        options: {
            responsive: false,
            scales: {
                y: { beginAtZero: true, precision: 0 }
            }
        }
    });

    // update chart ~5Hz
    interval = setInterval(updateChart, 200);

    // subscribe to store updates if you want immediate
    subscribe(updateChart);
}

function updateChart() {
    if (!chart) return;
    const { tally } = get();
    chart.data.datasets[0].data = [tally.yes, tally.no];
    chart.update('none');
}

export function stopVoteMeter() {
    if (interval) clearInterval(interval);
    interval = null;
    if (chart) {
        chart.destroy();
        chart = null;
    }
    const canvas = document.getElementById('voteChart');
    if (canvas) canvas.classList.add('hidden');
}
